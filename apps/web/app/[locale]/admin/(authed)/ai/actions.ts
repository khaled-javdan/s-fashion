"use server"

import { createHash } from "node:crypto"

import { z } from "zod"

import { REWRITE_TONES, type RewriteTone } from "@/components/admin/ai/types"
import { auth } from "@/lib/auth"
import {
  analyzeImage,
  getActiveAiModelId,
  rewriteText,
  translateText,
} from "@/lib/services/ai"
import { isSchemaKey, type SchemaKey } from "@/lib/services/ai-schemas"
import { tryAcquire } from "@/lib/services/rate-limit"

/**
 * Server Actions powering the three AI admin primitives.
 *
 * Every action: verifies the admin session, rate-limits per user, validates
 * input with Zod, calls the AI service, and returns a typed `{ ok, ... }`
 * result. None of them ever throw across the boundary — on any failure they
 * log server-side and return `{ ok: false, error }` so the form stays usable.
 */

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

const LIMITS = {
  analyze: { max: 30, windowMs: HOUR },
  translate: { max: 10, windowMs: MINUTE },
  rewrite: { max: 10, windowMs: MINUTE },
} as const

async function requireAdminId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { ok: false, error: "Not authorized." }
  return { ok: true, userId }
}

function checkRateLimit(
  userId: string,
  action: keyof typeof LIMITS,
): { ok: true } | { ok: false; error: string } {
  const { max, windowMs } = LIMITS[action]
  const allowed = tryAcquire(`ai:${userId}:${action}`, max, windowMs)
  return allowed ? { ok: true } : { ok: false, error: "Rate limit exceeded. Try again shortly." }
}

/** Short, non-reversible image-URL fingerprint for log lines. */
function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 12)
}

// ---------------------------------------------------------------------------
// analyzeImageAction
// ---------------------------------------------------------------------------

const analyzeInputSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(10),
  context: z.string().min(1).max(64),
  // Accept either a bare key or a `{ kind }` descriptor; both resolve to a key.
  schemaDescriptor: z.union([
    z.string(),
    z.object({ kind: z.string() }),
  ]),
})

function resolveSchemaKey(descriptor: unknown): SchemaKey | null {
  const raw =
    typeof descriptor === "string"
      ? descriptor
      : descriptor && typeof descriptor === "object" && "kind" in descriptor
        ? (descriptor as { kind: unknown }).kind
        : undefined
  return isSchemaKey(raw) ? raw : null
}

export async function analyzeImageAction(input: {
  imageUrls: string[]
  context: string
  schemaDescriptor: unknown
}): Promise<
  | { ok: true; suggestions: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const authed = await requireAdminId()
  if (!authed.ok) return authed

  const limited = checkRateLimit(authed.userId, "analyze")
  if (!limited.ok) return limited

  const parsed = analyzeInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid analysis request." }

  const schemaKey = resolveSchemaKey(parsed.data.schemaDescriptor)
  if (!schemaKey) return { ok: false, error: "Unknown suggestion schema." }

  try {
    const suggestions = await analyzeImage({
      imageUrls: parsed.data.imageUrls,
      schemaKey,
      context: parsed.data.context,
    })
    return { ok: true, suggestions }
  } catch (err) {
    console.error(
      `[ai.analyze] model=${await getActiveAiModelId()} schema=${schemaKey} context=${parsed.data.context} imgs=${parsed.data.imageUrls.length}:${hashUrl(parsed.data.imageUrls[0] ?? "")}`,
      err,
    )
    return { ok: false, error: "Could not analyze the image." }
  }
}

// ---------------------------------------------------------------------------
// translateAction
// ---------------------------------------------------------------------------

const translateInputSchema = z.object({
  text: z.string().min(1).max(4000),
  from: z.enum(["ar", "en"]),
  to: z.enum(["ar", "en"]),
  context: z.string().min(1).max(64),
})

export async function translateAction(input: {
  text: string
  from: "ar" | "en"
  to: "ar" | "en"
  context: string
}): Promise<
  | { ok: true; translated: string }
  | { ok: false; error: string }
> {
  const authed = await requireAdminId()
  if (!authed.ok) return authed

  const limited = checkRateLimit(authed.userId, "translate")
  if (!limited.ok) return limited

  const parsed = translateInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid translation request." }
  if (parsed.data.from === parsed.data.to) {
    return { ok: false, error: "Source and target language are the same." }
  }

  try {
    const translated = await translateText(parsed.data)
    return { ok: true, translated }
  } catch (err) {
    console.error(
      `[ai.translate] model=${await getActiveAiModelId()} from=${parsed.data.from} to=${parsed.data.to} context=${parsed.data.context}`,
      err,
    )
    return { ok: false, error: "Could not translate." }
  }
}

// ---------------------------------------------------------------------------
// rewriteAction
// ---------------------------------------------------------------------------

const rewriteInputSchema = z.object({
  text: z.string().min(1).max(4000),
  locale: z.enum(["ar", "en"]),
  tone: z.enum(REWRITE_TONES as unknown as [RewriteTone, ...RewriteTone[]]),
  context: z.string().min(1).max(64),
})

export async function rewriteAction(input: {
  text: string
  locale: "ar" | "en"
  tone: RewriteTone
  context: string
}): Promise<
  | { ok: true; rewritten: string }
  | { ok: false; error: string }
> {
  const authed = await requireAdminId()
  if (!authed.ok) return authed

  const limited = checkRateLimit(authed.userId, "rewrite")
  if (!limited.ok) return limited

  const parsed = rewriteInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid rewrite request." }

  try {
    const rewritten = await rewriteText(parsed.data)
    return { ok: true, rewritten }
  } catch (err) {
    console.error(
      `[ai.rewrite] model=${await getActiveAiModelId()} locale=${parsed.data.locale} tone=${parsed.data.tone} context=${parsed.data.context}`,
      err,
    )
    return { ok: false, error: "Could not rewrite the text." }
  }
}
