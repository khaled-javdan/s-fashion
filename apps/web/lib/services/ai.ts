import "server-only"

import { gateway } from "@ai-sdk/gateway"
import { generateObject, generateText, type LanguageModel } from "ai"

import {
  DEFAULT_AI_MODEL_ID,
  isAllowedModelId,
  type RewriteTone,
} from "@/components/admin/ai/types"
import { getAiFewShotExamples, getSetting } from "@/lib/repos/settings.repo"

import { cachedAnalyze, cacheKey } from "./ai-cache"
import {
  buildAnalyzePrompt,
  buildRewritePrompt,
  buildTranslatePrompt,
} from "./ai-prompts"
import { getSchema, SCHEMA_VERSION, type SchemaKey } from "./ai-schemas"

/**
 * Central AI service. Owns the provider/model choice, threads system prompts
 * through the Vercel AI SDK, and centralises caching for image analysis.
 *
 * All functions here run server-side only. `AI_GATEWAY_API_KEY` is picked up
 * automatically by the Gateway adapter (auto-injected on Vercel deploys; set
 * in `.env.local` for local dev — see AI-ADMIN.md §3).
 */

/**
 * Resolve the active Gateway model id, in priority order:
 *   1. The `ai.model` setting chosen by an admin in Settings → AI.
 *   2. The `AI_GATEWAY_MODEL` env override (handy for CI / scripts).
 *   3. The Claude Sonnet 4.5 default (AI-ADMIN.md §1 — best Arabic + vision).
 * An unknown/stale stored value is ignored so a bad row can't break the form.
 */
export async function getActiveAiModelId(): Promise<string> {
  const fromSettings = await getSetting("ai.model")
  if (isAllowedModelId(fromSettings)) return fromSettings
  const fromEnv = process.env.AI_GATEWAY_MODEL?.trim()
  if (fromEnv) return fromEnv
  return DEFAULT_AI_MODEL_ID
}

function model(modelId: string): LanguageModel {
  return gateway(modelId)
}

type Suggestions = Record<string, unknown>

/** Cap on fetching an image's bytes before we hand them to the model. */
const IMAGE_FETCH_TIMEOUT_MS = 15_000

/**
 * Download an image to bytes so we send the pixels to the model directly rather
 * than asking the Gateway to fetch the URL itself. The URL path intermittently
 * fails with `GatewayInternalServerError: Failed to download one or more
 * images`; fetching here removes that dependency (and works for any model).
 */
async function fetchImageBytes(
  url: string,
): Promise<{ data: Uint8Array; mediaType: string }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status}) ${url}`)
  }
  const mediaType = res.headers.get("content-type")?.split(";")[0]?.trim()
  const data = new Uint8Array(await res.arrayBuffer())
  return { data, mediaType: mediaType || "image/jpeg" }
}

/**
 * Recover a model's structured output when the strict JSON parser would reject
 * it: strip a markdown code fence, slice out the outermost `{…}` object if the
 * model wrapped it in prose, and drop trailing commas. Returns the cleaned text
 * for `generateObject` to re-parse, or `null` when there's nothing salvageable.
 * Wired in via `experimental_repairText` — see {@link analyzeImage}.
 */
function repairJsonText(text: string): string | null {
  if (!text) return null
  let t = text.trim()
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence?.[1]) t = fence[1].trim()
  const first = t.indexOf("{")
  const last = t.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1)
  }
  t = t.replace(/,(\s*[}\]])/g, "$1").trim()
  return t && t !== text.trim() ? t : null
}

/**
 * Hard ceiling for a single analysis request. Without it a stalled Gateway /
 * model call would hang forever — the server action would never return, the
 * panel's progress bar would freeze, and (worse) the in-flight cache entry
 * would never clear, poisoning that image until a cold start. On timeout the
 * abort signal rejects `generateObject`, which surfaces as `{ ok: false }`.
 *
 * Kept deliberately short: when the free-tier model is overloaded we want the
 * admin to learn quickly (and switch models via the inline picker) rather than
 * stare at a spinner for a minute and a half.
 */
const ANALYZE_TIMEOUT_MS = 60_000

/**
 * One retry (2 attempts total) instead of the SDK default of 2. Retrying a
 * busy free-tier model rarely helps — it just delays the failure — so we fail
 * fast and let the admin switch models. The abort signal still caps total time.
 */
const ANALYZE_MAX_RETRIES = 1

/**
 * Analyse one or more images and return structured suggestions for the given
 * schema. When several images are passed they are sent together as a single
 * multimodal request so the model can map each image to a colour variant.
 * Cached + deduplicated by (image URLs, schemaKey, schema-version, model).
 * The schema is resolved from the server-side allow-list — never the client.
 *
 * Pass `force` to bypass the cached result and recompute (e.g. the admin hit
 * "regenerate" to re-fill fields the model left blank on the first pass).
 */
export async function analyzeImage(input: {
  imageUrls: string[]
  schemaKey: SchemaKey
  context: string
  force?: boolean
}): Promise<Suggestions> {
  const { imageUrls, schemaKey, context, force } = input
  const modelId = await getActiveAiModelId()
  // Fold the model + every image URL into the cache key.
  const key = cacheKey(imageUrls.join("|"), schemaKey, `${SCHEMA_VERSION}:${modelId}`)

  return cachedAnalyze(
    key,
    async () => {
      const schema = getSchema(schemaKey)
      const examples = await getAiFewShotExamples()
      const system = buildAnalyzePrompt(context, examples)

      const intro =
        imageUrls.length > 1
          ? `Analyse these ${imageUrls.length} images (each a colour variant of the same product) and suggest values for the fields. Return one variant entry per image, in order.`
          : "Analyse this image and suggest values for the fields. Leave fields empty when you cannot infer them."

      // Fetch the pixels ourselves rather than passing URLs for the Gateway to
      // download — see `fetchImageBytes`.
      const images = await Promise.all(imageUrls.map(fetchImageBytes))

      const { object } = await generateObject({
        model: model(modelId),
        schema,
        system,
        maxRetries: ANALYZE_MAX_RETRIES,
        abortSignal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
        // Salvage fenced / prose-wrapped JSON before the strict parser rejects
        // it (some vision models don't emit bare JSON reliably).
        experimental_repairText: async ({ text }) => repairJsonText(text),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: intro },
              ...images.map((img) => ({
                type: "image" as const,
                image: img.data,
                mediaType: img.mediaType,
              })),
            ],
          },
        ],
      })

      // Strip undefined/empty so the form only sees fields worth applying.
      const out: Suggestions = {}
      for (const [k, v] of Object.entries(object as Suggestions)) {
        if (v === undefined || v === null) continue
        if (typeof v === "string" && v.trim() === "") continue
        if (Array.isArray(v) && v.length === 0) continue
        out[k] = v
      }
      return out
    },
    { force },
  )
}

/** Translate one bilingual field's value into its sibling language. */
export async function translateText(input: {
  text: string
  from: "ar" | "en"
  to: "ar" | "en"
  context: string
}): Promise<string> {
  const { text, from, to, context } = input
  const modelId = await getActiveAiModelId()
  const examples = await getAiFewShotExamples()
  const system = buildTranslatePrompt(from, to, context, examples)

  const { text: result } = await generateText({
    model: model(modelId),
    system,
    prompt: text,
  })
  return result.trim()
}

/** Rewrite a block of text in the same language with a chosen tone. */
export async function rewriteText(input: {
  text: string
  locale: "ar" | "en"
  tone: RewriteTone
  context: string
}): Promise<string> {
  const { text, locale, tone, context } = input
  const modelId = await getActiveAiModelId()
  const examples = await getAiFewShotExamples()
  const system = buildRewritePrompt(locale, tone, context, examples)

  const { text: result } = await generateText({
    model: model(modelId),
    system,
    prompt: text,
  })
  return result.trim()
}
