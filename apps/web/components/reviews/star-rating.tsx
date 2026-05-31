import { Star } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

type Props = {
  /** Average rating, 0–5 (may be fractional). */
  value: number
  /** When provided, renders a "(N)" count next to the stars. */
  count?: number
  size?: "sm" | "md"
  className?: string
}

const SIZE_CLASS = {
  sm: "size-3.5",
  md: "size-5",
} as const

const TEXT_CLASS = {
  sm: "text-xs",
  md: "text-sm",
} as const

/**
 * Presentational 5-star rating.
 *
 * Renders five outlined stars with a single clipped, gold-filled overlay sized
 * to `value / 5`, so a 4.3 shows exactly 4.3 stars filled — the partial star is
 * never rounded up or down visually. Decorative SVGs are hidden from the
 * accessibility tree; an `aria-label` carries the numeric value (and count).
 */
export function StarRating({ value, count, size = "sm", className }: Props) {
  const clamped = Math.max(0, Math.min(5, value))
  const fillPct = (clamped / 5) * 100
  const star = SIZE_CLASS[size]

  const label =
    count != null
      ? `${clamped} out of 5 stars, ${count} reviews`
      : `${clamped} out of 5 stars`

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={label}
    >
      <span className="relative inline-flex" aria-hidden="true">
        {/* Empty layer */}
        <span className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(star, "text-muted-foreground/30")} />
          ))}
        </span>
        {/* Filled layer, clipped to the fractional fill. `start-0` + ltr keeps
            the clip growing from the leading edge in both writing directions. */}
        <span
          className="absolute inset-y-0 start-0 flex overflow-hidden"
          style={{ width: `${fillPct}%` }}
          dir="ltr"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(star, "shrink-0 fill-amber-400 text-amber-400")}
            />
          ))}
        </span>
      </span>
      {count != null ? (
        <span className={cn("text-muted-foreground tabular-nums", TEXT_CLASS[size])}>
          ({count})
        </span>
      ) : null}
    </span>
  )
}
