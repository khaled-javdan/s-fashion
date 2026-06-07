/**
 * Shared types for the AI admin primitives.
 *
 * Pure types + a label table — no runtime dependencies, safe to import from
 * both client components and server code.
 */

// Type-only re-export: erased at compile time, so the Zod schema registry it
// lives next to never ends up in the client bundle.
export type { SchemaKey } from "@/lib/services/ai-schemas"

export type RewriteTone =
  | "shorter"
  | "longer"
  | "more_luxurious"
  | "more_casual"
  | "more_formal"
  | "punchier"

/** The default tone set offered by <AiRewriteMenu> when none is passed. */
export const REWRITE_TONES: readonly RewriteTone[] = [
  "shorter",
  "longer",
  "more_luxurious",
  "more_casual",
  "more_formal",
  "punchier",
]

/** Bilingual menu labels for each tone. */
export const REWRITE_TONE_LABELS: Record<
  RewriteTone,
  { en: string; ar: string }
> = {
  shorter: { en: "Shorter", ar: "أقصر" },
  longer: { en: "Longer", ar: "أطول" },
  more_luxurious: { en: "More luxurious", ar: "أكثر فخامة" },
  more_casual: { en: "More casual", ar: "أكثر بساطة" },
  more_formal: { en: "More formal", ar: "أكثر رسمية" },
  punchier: { en: "Punchier", ar: "أكثر تأثيرًا" },
}

export type Lang = "ar" | "en"

// ---------------------------------------------------------------------------
// AI model selection
// ---------------------------------------------------------------------------

/**
 * Production default — Mistral Medium 3.5. In testing it reliably fills every
 * field (bilingual name, HTML description, details list, colour variants). Used
 * when no model is set in settings and `AI_GATEWAY_MODEL` is unset.
 */
export const DEFAULT_AI_MODEL_ID = "mistral/mistral-medium-3.5"

export type AiModelOption = {
  id: string
  label: string
  /** Free-tier accessible on Vercel AI Gateway, or paid-credits only. */
  tier: "free" | "paid"
  note?: string
}

/**
 * Curated, allow-listed Gateway models the admin can choose between. Mirrors
 * the schema-registry allow-list pattern: the picker never accepts an arbitrary
 * model string. All entries are vision-capable so the image-analyze panel works
 * with any of them, and all run on paid Gateway credits. Ordered best-first.
 */
export const AI_MODEL_OPTIONS: readonly AiModelOption[] = [
  {
    id: "mistral/mistral-medium-3.5",
    label: "Mistral Medium 3.5",
    tier: "paid",
    note: "Recommended — reliably fills every field (bilingual copy + colours)",
  },
  {
    id: "openai/gpt-5-pro",
    label: "GPT-5 Pro",
    tier: "paid",
    note: "Most capable GPT — top-tier multimodal vision",
  },
  {
    id: "openai/gpt-4-turbo",
    label: "GPT-4 Turbo",
    tier: "paid",
    note: "Battle-tested, reliable vision with strong OCR & reasoning",
  },
  {
    id: "anthropic/claude-3-haiku",
    label: "Claude 3 Haiku",
    tier: "paid",
    note: "Lightest, fastest — good for basic-to-moderate image analysis",
  },
]

export function isAllowedModelId(value: unknown): value is string {
  return (
    typeof value === "string" && AI_MODEL_OPTIONS.some((o) => o.id === value)
  )
}
