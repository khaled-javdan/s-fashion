"use client"

import { Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { analyzeImageAction } from "@/app/[locale]/admin/(authed)/ai/actions"
import { hexToColorName } from "@/lib/color-name"

import { AI_MODEL_OPTIONS } from "./types"

type VariantSuggestion = {
  colorNameEn?: string
  colorNameAr?: string
  colorHex?: string
}

type Suggestions = Record<string, unknown>

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
  /** The active AI model id, used to name the model in a "busy" failure. */
  activeModelId?: string
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

/** Why a single image's analysis didn't produce suggestions. */
type Failure = { retryable: boolean; modelId?: string }

const validHex = (h?: string): string | null =>
  typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h) ? h : null

/** Description fields are HTML; show a trimmed plain-text preview only. */
function previewText(value: string): string {
  const text = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text.length > 90 ? `${text.slice(0, 90)}…` : text
}

type Phase = "idle" | "running" | "done"

/**
 * Admin-triggered product analysis with genuine per-image progress and
 * **per-image retry**.
 *
 * Each uploaded image is analyzed in its own request. Successful results are
 * kept keyed by image URL, and the panel derives the aggregated suggestions
 * from them (first non-empty value wins for each copy field; every image
 * contributes its detected colour, deduped by hex). When an image fails — most
 * often because the free-tier model was momentarily busy — only that image is
 * marked failed; the admin can **retry just the failed image(s)** without
 * re-running the ones that already succeeded. Nothing is applied automatically:
 * suggestions render with per-field "Use" / "Use all" controls.
 */
export function AiProductAnalyzePanel({
  imageUrls,
  onApply,
  activeModelId,
  className,
}: Props) {
  const t = useTranslations("admin.ai")
  const [phase, setPhase] = useState<Phase>("idle")
  // Successful analyses, keyed by image URL — the source of truth we aggregate.
  const [results, setResults] = useState<Record<string, Suggestions>>({})
  // Images whose last attempt failed (retryable = model busy / timed out).
  const [failed, setFailed] = useState<Record<string, Failure>>({})
  // Images currently in-flight (for per-row spinners + progress).
  const [runningUrls, setRunningUrls] = useState<Set<string>>(new Set())
  const [runTotal, setRunTotal] = useState(0)
  const [runDone, setRunDone] = useState(0)
  // Per-suggestion consumption: which scalars were used, and whether colours were.
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set())
  const [colorsUsed, setColorsUsed] = useState(false)

  // Guards against double-fire (e.g. an impatient second click mid-run).
  const runningRef = useRef(false)

  /**
   * Analyze a subset of image URLs, one after another, merging successes into
   * `results` and failures into `failed`. `force` recomputes server-side
   * (bypasses the analysis cache) — used by retry/regenerate so a previously
   * blank pass can re-fill fields.
   */
  const run = async (targetUrls: string[], opts?: { force?: boolean }) => {
    const urls = targetUrls.filter((u) => imageUrls.includes(u))
    if (runningRef.current || urls.length === 0) return
    runningRef.current = true

    setPhase("running")
    setRunTotal(urls.length)
    setRunDone(0)
    setRunningUrls(new Set(urls))

    let anySuccess = false
    // try/finally guarantees the panel leaves the "running" phase even if a
    // request throws — otherwise the spinner would hang and the controls
    // (disabled while running) could never recover it.
    try {
      for (const url of urls) {
        try {
          const res = await analyzeImageAction({
            imageUrls: [url],
            context: "product",
            schemaDescriptor: "product-suggestions-v3",
            force: opts?.force,
          })
          if (res.ok) {
            anySuccess = true
            setResults((prev) => ({ ...prev, [url]: res.suggestions }))
            setFailed((prev) => {
              if (!prev[url]) return prev
              const next = { ...prev }
              delete next[url]
              return next
            })
          } else {
            setFailed((prev) => ({
              ...prev,
              [url]: {
                retryable: !!res.retryable,
                modelId: res.modelId ?? activeModelId,
              },
            }))
          }
        } catch {
          setFailed((prev) => ({ ...prev, [url]: { retryable: false } }))
        }
        setRunningUrls((prev) => {
          const next = new Set(prev)
          next.delete(url)
          return next
        })
        setRunDone((n) => n + 1)
      }
    } finally {
      // A retry may have produced a new colour — re-surface the colour row so
      // the admin can (re)apply the now-complete set.
      if (anySuccess) setColorsUsed(false)
      setRunningUrls(new Set())
      setPhase("done")
      runningRef.current = false
    }
  }

  // Full re-run from scratch: drop every prior result and recompute all images.
  const regenerateAll = () => {
    setResults({})
    setFailed({})
    setUsedKeys(new Set())
    setColorsUsed(false)
    void run(imageUrls, { force: true })
  }

  // Aggregate the per-image results in image order: first non-empty scalar wins,
  // colours dedupe by hex. Recomputed whenever results (or the image set) change,
  // so a successful retry immediately folds its colour/copy into the suggestions.
  const { scalars, colors } = useMemo(() => {
    const aggScalars: Partial<Record<ScalarKey, string>> = {}
    const aggColors: DetectedColor[] = []
    const seenHex = new Set<string>()
    for (const url of imageUrls) {
      const s = results[url]
      if (!s) continue
      for (const key of SCALAR_KEYS) {
        if (aggScalars[key]) continue
        const v = s[key]
        if (typeof v === "string" && v.trim() !== "") aggScalars[key] = v.trim()
      }
      const sv = Array.isArray(s.variants)
        ? (s.variants[0] as VariantSuggestion | undefined)
        : undefined
      // Lowercase the hex so it always matches the image tag (the storefront
      // links photos to colours by exact, case-sensitive hex).
      const hex = validHex(sv?.colorHex)?.toLowerCase()
      if (hex && !seenHex.has(hex)) {
        seenHex.add(hex)
        // The model sometimes returns a colour swatch with no name (busy
        // prints). Derive a readable bilingual name from the hex so the swatch
        // is never blank — and so the saved variant always has a colour name.
        const fallback = hexToColorName(hex)
        aggColors.push({
          url,
          colorHex: hex,
          colorNameEn: sv?.colorNameEn?.trim() || fallback?.en || "",
          colorNameAr: sv?.colorNameAr?.trim() || fallback?.ar || "",
        })
      }
    }
    return { scalars: aggScalars, colors: aggColors }
  }, [results, imageUrls])

  const visibleScalars = SCALAR_KEYS.filter(
    (k) => scalars[k] && !usedKeys.has(k),
  ) as ScalarKey[]
  const visibleColors = colorsUsed ? [] : colors
  const hasVisible = visibleScalars.length > 0 || visibleColors.length > 0

  // Failed images still present in the current image set (and not since fixed).
  const failedUrls = imageUrls.filter((u) => failed[u] && !results[u])
  const anyRetryable = failedUrls.some((u) => failed[u]?.retryable)
  const busyModelLabel = (() => {
    const id =
      failedUrls.map((u) => failed[u]?.modelId).find(Boolean) ?? activeModelId
    if (!id) return null
    return AI_MODEL_OPTIONS.find((o) => o.id === id)?.label ?? id
  })()

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
  const pct = runTotal > 0 ? Math.round((runDone / runTotal) * 100) : 0

  // Idle (never run, or re-collapsed): a single trigger button.
  if (phase === "idle") {
    return (
      <div className={cn("flex justify-end", className)}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run(imageUrls)}
        >
          <Sparkles className="text-primary" aria-hidden />
          {t("analyze.trigger")}
        </Button>
      </div>
    )
  }

  // Done, everything applied/dismissed and nothing failed: leave only a
  // regenerate control so the admin can re-run on demand.
  if (phase === "done" && !hasVisible && failedUrls.length === 0) {
    return (
      <div className={cn("flex justify-end", className)}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={regenerateAll}
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
              ? t("analyze.progress", { done: runDone, total: runTotal })
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
            onClick={regenerateAll}
            title={t("analyze.regenerate")}
          >
            <RefreshCw className={cn(running && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Determinate progress bar — only for multi-image runs; a single-image
          retry shows its spinner inline on the failed row instead. */}
      {running && runTotal > 1 ? (
        <div
          className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={runTotal}
          aria-valuenow={runDone}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {/* Failed images — retry just these, no need to re-run the good ones. */}
      {failedUrls.length > 0 ? (
        <div className="mt-3 space-y-2">
          {anyRetryable && busyModelLabel ? (
            <p className="text-destructive text-xs" role="alert">
              {t("analyze.model_busy", { model: busyModelLabel })}
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {failedUrls.map((url) => {
              const index = imageUrls.indexOf(url) + 1
              const isRetrying = runningUrls.has(url)
              return (
                <li
                  key={url}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="size-9 shrink-0 rounded object-cover"
                    />
                    <span className="text-muted-foreground text-xs">
                      {t("analyze.image_failed", { index })}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={running}
                    onClick={() => run([url], { force: true })}
                  >
                    {isRetrying ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="size-3" aria-hidden />
                    )}
                    {t("analyze.retry")}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {hasVisible ? (
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
