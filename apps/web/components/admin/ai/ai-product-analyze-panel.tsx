"use client"

import { Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { analyzeImageAction } from "@/app/[locale]/admin/(authed)/ai/actions"

type VariantSuggestion = {
  colorNameEn?: string
  colorNameAr?: string
  colorHex?: string
}

/** One detected colour tied back to the image it was found in. */
export type DetectedColor = {
  url: string
  colorHex: string
  colorNameEn: string
  colorNameAr: string
}

/** A subset of suggestions the admin chose to apply onto the form. */
export type AiApplyPayload = {
  scalars?: Record<string, string>
  colors?: DetectedColor[]
}

type Props = {
  /** Vercel Blob URLs of every uploaded image, in order. */
  imageUrls: string[]
  /** Called when the admin applies a suggestion subset ("Use" / "Use all"). */
  onApply: (payload: AiApplyPayload) => void
  className?: string
}

/** Scalar copy fields, in the order they're listed in the panel. */
const SCALAR_KEYS = [
  "nameEn",
  "nameAr",
  "descEn",
  "descAr",
  "additionalInfoEn",
  "additionalInfoAr",
  "slug",
] as const

type ScalarKey = (typeof SCALAR_KEYS)[number]

const validHex = (h?: string): string | null =>
  typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h) ? h : null

/** Description fields are HTML; show a trimmed plain-text preview only. */
function previewText(value: string): string {
  const text = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text.length > 90 ? `${text.slice(0, 90)}…` : text
}

type Phase = "idle" | "running" | "done"

/**
 * Admin-triggered product analysis with genuine per-image progress.
 *
 * Each uploaded image is analyzed in its own request, one after another, so the
 * bar reflects real completion ("Analyzed 2 of 5") rather than a fake timer.
 * Results are aggregated as they arrive — the first non-empty value wins for
 * each copy field, and every image contributes its detected colour (deduped by
 * hex). Nothing is applied automatically: suggestions render with per-field
 * "Use" / "Use all" controls and the chosen subset is handed back via onApply.
 */
export function AiProductAnalyzePanel({ imageUrls, onApply, className }: Props) {
  const t = useTranslations("admin.ai")
  const [phase, setPhase] = useState<Phase>("idle")
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [scalars, setScalars] = useState<Partial<Record<ScalarKey, string>>>({})
  const [colors, setColors] = useState<DetectedColor[]>([])
  const [errorCount, setErrorCount] = useState(0)
  // Per-suggestion consumption: which scalars were used, and whether colours were.
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set())
  const [colorsUsed, setColorsUsed] = useState(false)

  // Guards against double-fire (e.g. an impatient second click mid-run).
  const runningRef = useRef(false)

  const run = async () => {
    if (runningRef.current || imageUrls.length === 0) return
    runningRef.current = true

    setPhase("running")
    setDone(0)
    setTotal(imageUrls.length)
    setScalars({})
    setColors([])
    setErrorCount(0)
    setUsedKeys(new Set())
    setColorsUsed(false)

    const aggScalars: Partial<Record<ScalarKey, string>> = {}
    const aggColors: DetectedColor[] = []
    const seenHex = new Set<string>()
    let errors = 0

    for (const url of imageUrls) {
      let suggestions: Record<string, unknown> | null = null
      try {
        const res = await analyzeImageAction({
          imageUrls: [url],
          context: "product",
          schemaDescriptor: "product-suggestions-v3",
        })
        if (res.ok) suggestions = res.suggestions
        else errors += 1
      } catch {
        errors += 1
      }

      if (suggestions) {
        for (const key of SCALAR_KEYS) {
          if (aggScalars[key]) continue
          const v = suggestions[key]
          if (typeof v === "string" && v.trim() !== "") aggScalars[key] = v.trim()
        }
        const sv = Array.isArray(suggestions.variants)
          ? (suggestions.variants[0] as VariantSuggestion | undefined)
          : undefined
        const hex = validHex(sv?.colorHex)
        if (hex && !seenHex.has(hex.toLowerCase())) {
          seenHex.add(hex.toLowerCase())
          aggColors.push({
            url,
            colorHex: hex,
            colorNameEn: sv?.colorNameEn?.trim() ?? "",
            colorNameAr: sv?.colorNameAr?.trim() ?? "",
          })
        }
      }

      // Surface results as they stream in.
      setScalars({ ...aggScalars })
      setColors([...aggColors])
      setDone((n) => n + 1)
    }

    setErrorCount(errors)
    setPhase("done")
    runningRef.current = false
  }

  const visibleScalars = SCALAR_KEYS.filter(
    (k) => scalars[k] && !usedKeys.has(k),
  ) as ScalarKey[]
  const visibleColors = colorsUsed ? [] : colors
  const hasVisible = visibleScalars.length > 0 || visibleColors.length > 0

  const applyScalar = (key: ScalarKey) => {
    const value = scalars[key]
    if (value == null) return
    onApply({ scalars: { [key]: value } })
    setUsedKeys((prev) => new Set(prev).add(key))
  }
  const applyColors = () => {
    if (visibleColors.length === 0) return
    onApply({ colors: visibleColors })
    setColorsUsed(true)
  }
  const applyAll = () => {
    const picked: Record<string, string> = {}
    for (const k of visibleScalars) picked[k] = scalars[k] as string
    onApply({
      scalars: Object.keys(picked).length ? picked : undefined,
      colors: visibleColors.length ? visibleColors : undefined,
    })
    setUsedKeys(new Set(SCALAR_KEYS))
    setColorsUsed(true)
  }

  // No images yet: a dashed idle hint, matching the rest of the AI surfaces.
  if (imageUrls.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-3 text-xs",
          className,
        )}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {t("analyze.idle_hint")}
      </div>
    )
  }

  const running = phase === "running"
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // Idle (never run, or re-collapsed): a single trigger button.
  if (phase === "idle") {
    return (
      <div className={cn("flex justify-end", className)}>
        <Button type="button" variant="outline" size="sm" onClick={run}>
          <Sparkles className="text-primary" aria-hidden />
          {t("analyze.trigger")}
        </Button>
      </div>
    )
  }

  // Done, but every suggestion has been applied/dismissed: leave only a
  // regenerate control so the admin can re-run on demand.
  if (phase === "done" && !hasVisible && errorCount === 0) {
    return (
      <div className={cn("flex justify-end", className)}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={run}
          title={t("analyze.regenerate")}
        >
          <RefreshCw aria-hidden />
          {t("analyze.regenerate")}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("rounded-md border p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="text-primary h-4 w-4" aria-hidden />
          )}
          <span>
            {running
              ? t("analyze.progress", { done, total })
              : t("analyze.heading")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!running && hasVisible ? (
            <Button type="button" size="xs" onClick={applyAll}>
              {t("analyze.use_all")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={running}
            onClick={run}
            title={t("analyze.regenerate")}
          >
            <RefreshCw className={cn(running && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Determinate progress bar — real per-image completion. */}
      {running ? (
        <div
          className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {!running && errorCount > 0 ? (
        <p className="text-destructive mt-2 text-xs" role="alert">
          {t("analyze.errors", { count: errorCount })}
        </p>
      ) : null}

      {!running && hasVisible ? (
        <ul className="mt-3 space-y-1.5">
          {visibleScalars.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span className="text-muted-foreground text-xs">
                  {t(`analyze.field.${key}`)}:
                </span>{" "}
                <span className="break-words">
                  {previewText(scalars[key] as string)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => applyScalar(key)}
              >
                {t("analyze.use")}
              </Button>
            </li>
          ))}

          {visibleColors.length > 0 ? (
            <li className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {t("analyze.colours", { count: visibleColors.length })}
                </span>
                {visibleColors.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block size-3 rounded-full border"
                      style={{ backgroundColor: c.colorHex }}
                      aria-hidden
                    />
                    <span className="text-xs">
                      {c.colorNameEn || c.colorNameAr || c.colorHex}
                    </span>
                  </span>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={applyColors}
              >
                {t("analyze.use")}
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {!running && hasVisible ? (
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs"
        >
          <X className="size-3" aria-hidden />
          {t("analyze.dismiss")}
        </button>
      ) : null}
    </div>
  )
}
