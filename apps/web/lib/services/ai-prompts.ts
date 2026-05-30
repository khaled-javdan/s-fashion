import "server-only"

import type { RewriteTone } from "@/components/admin/ai/types"
import type { FewShotExample } from "@/lib/repos/settings.repo"

/**
 * System-prompt builders for the AI admin copilot.
 *
 * Every prompt is: base brand voice + a context-specific instruction +
 * (optional) few-shot brand examples pulled from the `ai.few_shot_examples`
 * setting. The few-shot block is appended only when examples exist, so Arabic
 * register can be tightened later via Prisma Studio with no redeploy.
 */

const BASE_PROMPT = `You are an assistant for S Fashion, a UAE-based brand selling mukhawar — traditional Arabic ladies' dresses. The target audience is local Arab women in the UAE and GCC, price band 250–400 AED (mid-to-high end). When writing Arabic, use formal Modern Standard Arabic suitable for women's luxury fashion; avoid colloquial Khaleeji or Egyptian dialect. When writing English, use elegant, restrained, fashion-magazine register. Never invent prices, stock numbers, or SKUs. Never claim materials you cannot verify from the image.`

function fewShotBlock(examples: FewShotExample[] | null): string {
  if (!examples || examples.length === 0) return ""
  const rendered = examples
    .slice(0, 5)
    .map((e, i) => {
      const lines = [`Example ${i + 1}:`]
      if (e.nameEn) lines.push(`  EN name: ${e.nameEn}`)
      if (e.nameAr) lines.push(`  AR name: ${e.nameAr}`)
      if (e.descEn) lines.push(`  EN description: ${e.descEn}`)
      if (e.descAr) lines.push(`  AR description: ${e.descAr}`)
      return lines.join("\n")
    })
    .join("\n\n")
  return `\n\nHere are examples of approved brand copy. Match their tone, length, and register:\n\n${rendered}`
}

/**
 * Prompt for image analysis. `context` is the surface hint (e.g. "product").
 * The model is told to leave fields empty when it can't infer them.
 */
export function buildAnalyzePrompt(
  context: string,
  examples: FewShotExample[] | null,
): string {
  const surface =
    context === "product"
      ? `You are looking at one or more photos of a single mukhawar dress product. Suggest product-level copy based only on what you can see: garment style, embroidery, neckline, sleeves, silhouette, fabric texture, and the occasion it suits.

Two fields — descEn/descAr and additionalInfoEn/additionalInfoAr — are rich text. Return them as valid HTML using ONLY these tags: <p>, <strong>, <em>, <ul>, <ol>, <li>. Never use markdown, code fences, headings, inline styles, or any other tag. Translate every Arabic field into formal MSA; do not leave Arabic as English.

- nameEn / nameAr: a concise product name in each language (plain text, no HTML).
- descEn / descAr: an inviting description in each language, written as ONE or TWO short paragraphs (about 2–4 sentences total) of flowing prose — evoke how the piece looks and drapes and when she might wear it. Wrap each paragraph in its own <p>…</p>. Use <em> sparingly for emphasis. No lists here.
- additionalInfoEn / additionalInfoAr: a concise "details" list in each language, as a single <ul> of 3–6 <li> items. Each item pairs a bold label with a short value, e.g. "<li><strong>Neckline:</strong> rounded with embroidered trim</li>". Cover ONLY attributes visible or safely inferable from the photos — choose from: fabric/texture, embroidery, neckline, sleeves, silhouette/fit, length, occasion. Do NOT state fabric composition percentages, care/washing instructions, exact measurements, or country of origin — you cannot verify these from an image.
- slug: ALWAYS produce a short, lowercase, hyphenated English slug derived from the English name (e.g. "rosewood-embroidered-mukhawar"). Never leave it empty.
- variants: treat EACH image as a distinct colour variant of the same product. Return one entry per image, IN THE SAME ORDER as the images. For each: colorNameEn and colorNameAr (the fabric colour name in each language, formal MSA for Arabic), and colorHex — the dominant fabric colour as a #RRGGBB hex. Always include colorHex for every image.

Leave a copy field empty only if you genuinely cannot infer it. Output only the HTML/text for each field — no surrounding commentary, quotes, or labels.`
      : context === "hero-slide"
        ? `You are looking at a hero banner image for the S Fashion storefront home page. Suggest short, elegant marketing copy that suits the mood of the image, in both English and Arabic:
- eyebrowEn / eyebrowAr: a very short kicker label above the headline (1–3 words, e.g. "New collection").
- headlineEn / headlineAr: a concise, evocative headline (a few words).
- subtextEn / subtextAr: one short supporting sentence.
- ctaLabelEn / ctaLabelAr: a short call-to-action button label (e.g. "Shop now").
Keep Arabic in formal MSA. Leave a field empty only if you genuinely cannot infer it.`
        : `You are looking at an image for the "${context}" surface. Suggest values for the requested fields based only on what you can see. Leave a field empty if you genuinely cannot infer it from the image.`
  return `${BASE_PROMPT}\n\n${surface}${fewShotBlock(examples)}`
}

/** Prompt for translating one bilingual field into its sibling. */
export function buildTranslatePrompt(
  from: "ar" | "en",
  to: "ar" | "en",
  context: string,
  examples: FewShotExample[] | null,
): string {
  const langName = (l: "ar" | "en") => (l === "ar" ? "Arabic" : "English")
  const instruction = `Translate the following ${langName(from)} text to ${langName(
    to,
  )}. This text is for the "${context}" surface. Preserve the brand register. If the text contains HTML tags, keep the tag structure exactly as-is and translate only the human-readable text between the tags — do not add, remove, or reorder tags. Output only the translation, with no commentary, quotes, or labels.`
  return `${BASE_PROMPT}\n\n${instruction}${fewShotBlock(examples)}`
}

/** Prompt for rewriting a textarea with a chosen tone. */
export function buildRewritePrompt(
  locale: "ar" | "en",
  tone: RewriteTone,
  context: string,
  examples: FewShotExample[] | null,
): string {
  const langName = locale === "ar" ? "Arabic" : "English"
  const toneText: Record<RewriteTone, string> = {
    shorter: "more concise — trim it without losing key product details",
    longer: "longer and more descriptive, while staying truthful to the original",
    more_luxurious: "more luxurious and elevated in register",
    more_casual: "more casual and approachable",
    more_formal: "more formal",
    punchier: "punchier and more compelling",
  }
  const instruction = `Rewrite the following ${langName} text to be ${toneText[tone]}. This text is for the "${context}" surface. Preserve the meaning and any product-specific details. Output only the rewrite, with no commentary, quotes, or labels.`
  return `${BASE_PROMPT}\n\n${instruction}${fewShotBlock(examples)}`
}
