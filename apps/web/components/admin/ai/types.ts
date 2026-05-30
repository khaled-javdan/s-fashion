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
 * Production default — Claude Sonnet 4.5 (AI-ADMIN.md §1). Used when no model
 * is configured in settings and `AI_GATEWAY_MODEL` is unset.
 */
export const DEFAULT_AI_MODEL_ID = "anthropic/claude-sonnet-4-5"

export type AiModelOption = {
  id: string
  label: string
  /** Free-tier accessible on Vercel AI Gateway, or paid-credits only. */
  tier: "free" | "paid"
  note?: string
}

/**
 * Curated, allow-listed Gateway models the admin can choose between. Mirrors
 * the schema-registry allow-list pattern: the picker never accepts an
 * arbitrary model string. Tiers reflect what a free Gateway account can call
 * (verified live) vs what needs paid credits. All entries are vision-capable
 * so the image-analyze panel works with any of them.
 */
export const AI_MODEL_OPTIONS: readonly AiModelOption[] = [
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    tier: "paid",
    note: "Best Arabic register & vision — recommended for production",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    tier: "free",
    note: "Strong free pick — good Arabic + vision",
  },
  { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "free" },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    tier: "free",
    note: "Cheapest free option",
  },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano", tier: "free" },
]

export function isAllowedModelId(value: unknown): value is string {
  return (
    typeof value === "string" && AI_MODEL_OPTIONS.some((o) => o.id === value)
  )
}
