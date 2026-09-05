"use client"

import { useEffect, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { stockLevel, stockMeterPercent } from "@/lib/stock-urgency"

type Props = {
  /** Stock available for the relevant scope (selected variant, or aggregate). */
  stock: number
  /** Pre-translated labels (caller supplies via next-intl). */
  labels: {
    inStock: string
    outOfStock: string
    /** Already pluralised count, e.g. "Only 2 left". */
    remaining: string
    /** Caption shown under the meter at the critical level. */
    almostGone: string
  }
}

/**
 * Stock indicator for the PDP, escalating with how little is left:
 *
 * - `ok`       — a quiet "In stock" line, no motion.
 * - `low`      — accent pill with the real count and a depletion meter.
 * - `critical` — destructive pill, a live throbbing dot + ping halo, a shine
 *   sweep, and an "almost gone" caption.
 * - `out`      — flat destructive outline, deliberately motionless: there is
 *   nothing to hurry for.
 *
 * The count is always the true `ProductVariant.stock`, so the urgency never
 * outruns the inventory. The meter width transitions in on mount and again
 * whenever the caller remounts it (keyed on the selected variant), which is
 * what makes switching size feel responsive.
 */
export function StockBadge({ stock, labels }: Props) {
  const level = stockLevel(stock)
  // Start collapsed so the first paint animates the bar out to its real width.
  const [meterWidth, setMeterWidth] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setMeterWidth(stockMeterPercent(stock)),
    )
    return () => cancelAnimationFrame(frame)
  }, [stock])

  if (level === "out") {
    return (
      <span className="border-destructive/40 text-destructive inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
        {labels.outOfStock}
      </span>
    )
  }

  if (level === "ok") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <span className="bg-foreground/40 size-1.5 rounded-full" />
        {labels.inStock}
      </span>
    )
  }

  const critical = level === "critical"

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-2 duration-500">
      <span
        className={cn(
          "relative inline-flex w-fit items-center gap-2 overflow-hidden rounded-full px-3 py-1 text-xs font-semibold",
          critical
            ? "bg-destructive/10 text-destructive"
            : "bg-accent text-accent-foreground",
        )}
      >
        {/* Decorative highlight sweeping across the pill. Rendered first so it
            paints beneath the dot and label — two positioned siblings stack in
            DOM order, and a highlight over the text just muddies the count. */}
        {critical ? (
          <span
            aria-hidden
            className="animate-urgency-shine pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent from-35% via-white/55 via-50% to-transparent to-65%"
          />
        ) : null}

        {/* Live dot: a static core with a ping halo behind it at the critical
            level, so the pill reads as a real-time count rather than a label. */}
        <span className="relative flex size-2 shrink-0 items-center justify-center">
          {critical ? (
            <span className="bg-destructive absolute inline-flex size-full animate-ping rounded-full opacity-70" />
          ) : null}
          <span
            className={cn(
              "relative inline-flex size-2 rounded-full",
              critical
                ? "bg-destructive animate-urgency-throb"
                : "bg-accent-foreground/60",
            )}
          />
        </span>

        <span className="relative tabular-nums">{labels.remaining}</span>
      </span>

      {/* Depletion meter. `flex` places the fill at the inline start, so it
          fills from the right under RTL without any direction-specific CSS. */}
      <div
        className="bg-muted flex h-1 w-full max-w-56 overflow-hidden rounded-full"
        role="presentation"
      >
        <span
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            critical ? "bg-destructive" : "bg-accent-foreground/70",
          )}
          style={{ width: `${meterWidth}%` }}
        />
      </div>

      {critical ? (
        <span className="text-destructive/80 text-xs">{labels.almostGone}</span>
      ) : null}
    </div>
  )
}
