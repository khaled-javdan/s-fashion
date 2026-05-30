"use client"

import { Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { analyzeImageAction } from "@/app/[locale]/admin/(authed)/ai/actions"
import type { SchemaKey } from "@/components/admin/ai/types"

type Suggestions = Record<string, unknown>
type VariantSuggestion = {
  colorNameEn?: string
  colorNameAr?: string
  colorHex?: string
}

type Props = {
  /** Vercel Blob URLs of every uploaded image, in order. */
  imageUrls: string[]
  /** Allow-listed schema key describing the shape of suggestions to ask for. */
  schema: SchemaKey
  /** Hint passed into the system prompt so the AI knows the surface. */
  context: string
  /** Called when suggestions are applied — "Use all" or a single field/variants subset. */
  onSuggestions: (suggestions: Suggestions) => void
  /** Optional label override. Defaults to a translated "AI suggestions". */
  label?: string
  /** Optional idle hint shown before any image is uploaded. */
  idleHint?: string
  className?: string
}

/** Schema keys that have a dedicated translated field label. */
const KNOWN_FIELD_KEYS = new Set([
  // Product
  "nameEn",
  "nameAr",
  "descEn",
  "descAr",
  "slug",
  // Hero slide
  "eyebrowEn",
  "eyebrowAr",
  "headlineEn",
  "headlineAr",
  "subtextEn",
  "subtextAr",
  "ctaLabelEn",
  "ctaLabelAr",
])

function fallbackHumanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * Every non-empty string field becomes a suggestion line, in the schema's key
 * order. The `variants` array is excluded — it's rendered separately. This
 * keeps the panel schema-agnostic (product, hero slide, future surfaces).
 */
function scalarEntries(s: Suggestions): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [key, v] of Object.entries(s)) {
    if (key === "variants") continue
    if (typeof v === "string" && v.trim() !== "") out.push([key, v])
  }
  return out
}

/**
 * Suggests copy and one colour variant per image from the uploaded images.
 *
 * Never runs automatically — analysis is admin-triggered via the refresh
 * control, so merely opening a form (e.g. the home-hero settings) never fires a
 * request. Results are cached per image-set and restored when revisited.
 * Applying a suggestion ("Use" / "Use all") collapses it away.
 */
export function AiImageAnalyzePanel({
  imageUrls,
  schema,
  context,
  onSuggestions,
  label,
  idleHint,
  className,
}: Props) {
  const t = useTranslations("admin.ai")
  const resolvedLabel = label ?? t("analyze.heading")
  const resolvedIdleHint = idleHint ?? t("analyze.idle_hint")
  const fieldLabel = (key: string): string =>
    KNOWN_FIELD_KEYS.has(key) ? t(`analyze.field.${key}`) : fallbackHumanize(key)
  const [pending, startTransition] = useTransition()
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Per-suggestion consumption: scalar keys used, and whether variants were used.
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set())
  const [variantsUsed, setVariantsUsed] = useState(false)

  const memo = useRef<Map<string, Suggestions>>(new Map())
  const urlsKey = imageUrls.join("|")

  const resetConsumption = () => {
    setUsedKeys(new Set())
    setVariantsUsed(false)
  }

  const run = useCallback(
    (urls: string[]) => {
      if (urls.length === 0) return
      setError(null)
      resetConsumption()
      startTransition(async () => {
        const result = await analyzeImageAction({
          imageUrls: urls,
          context,
          schemaDescriptor: schema,
        })
        if (result.ok) {
          memo.current.set(urls.join("|"), result.suggestions)
          setSuggestions(result.suggestions)
        } else {
          setError(result.error)
        }
      })
    },
    [context, schema],
  )

  // Never auto-run. When the image set changes, restore a cached result for it
  // if we have one, otherwise clear — analysis is only ever started by the
  // admin via the refresh control. This is what keeps merely opening a form
  // (e.g. the home-hero settings) from firing an analysis request.
  useEffect(() => {
    if (imageUrls.length === 0) {
      // Clear cached suggestions in sync with the incoming image set.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions(null)
      resetConsumption()
      return
    }
    setSuggestions(memo.current.get(urlsKey) ?? null)
    resetConsumption()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  if (imageUrls.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-3 text-xs",
          className,
        )}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {resolvedIdleHint}
      </div>
    )
  }

  const scalars = suggestions
    ? scalarEntries(suggestions).filter(([k]) => !usedKeys.has(k))
    : []
  const variantList: VariantSuggestion[] =
    suggestions && Array.isArray(suggestions.variants) && !variantsUsed
      ? (suggestions.variants as VariantSuggestion[])
      : []
  const hasVisible = scalars.length > 0 || variantList.length > 0

  const applyScalar = (key: string, value: string) => {
    onSuggestions({ [key]: value })
    setUsedKeys((prev) => new Set(prev).add(key))
  }
  const applyVariants = () => {
    if (!suggestions) return
    onSuggestions({ variants: suggestions.variants })
    setVariantsUsed(true)
  }
  const applyAll = () => {
    if (!suggestions) return
    onSuggestions(suggestions)
    setUsedKeys(new Set(scalarEntries(suggestions).map(([k]) => k)))
    setVariantsUsed(true)
  }

  // Collapsed state: a suggestion set was generated and then fully applied or
  // dismissed. Leave ONLY a refresh icon so the admin can regenerate on demand.
  if (!pending && !error && suggestions !== null && !hasVisible) {
    return (
      <div className={cn("flex justify-end", className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => run(imageUrls)}
          title={t("analyze.regenerate")}
          aria-label={t("analyze.regenerate")}
        >
          <RefreshCw aria-hidden />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("rounded-md border p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>{t("analyze.generating", { count: imageUrls.length })}</span>
            </>
          ) : (
            <>
              <Sparkles className="text-primary h-4 w-4" aria-hidden />
              <span>{resolvedLabel}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasVisible && !pending ? (
            <Button type="button" size="xs" onClick={applyAll}>
              {t("analyze.use_all")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={pending}
            onClick={() => run(imageUrls)}
            title={t("analyze.regenerate")}
          >
            <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {error ? (
        <div
          className="text-destructive mt-2 flex items-center justify-between gap-2 text-xs"
          role="alert"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setError(null)}
            title={t("analyze.dismiss")}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      {!pending && hasVisible ? (
        <ul className="mt-3 space-y-1.5">
          {scalars.map(([key, value]) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span className="text-muted-foreground text-xs">
                  {fieldLabel(key)}:
                </span>{" "}
                <span className="break-words">{value}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => applyScalar(key, value)}
              >
                {t("analyze.use")}
              </Button>
            </li>
          ))}

          {variantList.length > 0 ? (
            <li className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t("analyze.colours", { count: variantList.length })}
                </span>
                {variantList.map((v, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block size-3 rounded-full border"
                      style={
                        v.colorHex ? { backgroundColor: v.colorHex } : undefined
                      }
                      aria-hidden
                    />
                    <span className="text-xs">
                      {v.colorNameEn || v.colorNameAr || v.colorHex || "—"}
                    </span>
                  </span>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={applyVariants}
              >
                {t("analyze.use")}
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
