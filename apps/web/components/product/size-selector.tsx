"use client"

import { cn } from "@workspace/ui/lib/utils"

import { CRITICAL_STOCK_THRESHOLD } from "@/lib/stock-urgency"

export type SizeOption = {
  size: string
  /** Whether this size is available (in stock) for the current color selection. */
  available: boolean
  /** Units left for this size in the current color — drives the urgency dot. */
  stock: number
}

type Props = {
  options: SizeOption[]
  selected: string | null
  onSelect: (size: string) => void
  /** Pre-translated "Only N left", used as the scarce chip's tooltip. */
  lowStockLabel: (stock: number) => string
}

/**
 * Row of size buttons. Out-of-stock sizes for the current color are visually
 * disabled (not removed) and cannot be selected. Uses `aria-pressed`.
 *
 * Sizes at or below {@link CRITICAL_STOCK_THRESHOLD} carry a throbbing dot in
 * the corner, so the shopper sees which size is about to go before they pick
 * one — the tooltip and the picker's badge carry the actual number.
 */
export function SizeSelector({
  options,
  selected,
  onSelect,
  lowStockLabel,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option.size === selected
        const scarce =
          option.available && option.stock <= CRITICAL_STOCK_THRESHOLD
        return (
          <button
            key={option.size}
            type="button"
            aria-pressed={isSelected}
            disabled={!option.available}
            onClick={() => onSelect(option.size)}
            title={scarce ? lowStockLabel(option.stock) : undefined}
            className={cn(
              "relative min-w-12 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isSelected
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground/60",
              !option.available &&
                "text-muted-foreground/50 cursor-not-allowed line-through opacity-50 hover:border-border",
            )}
          >
            {option.size}
            {scarce ? (
              <span
                aria-hidden
                // `end` keeps the dot on the trailing corner in both scripts;
                // the ring separates it from the filled chip when selected.
                className="animate-urgency-throb bg-destructive ring-background absolute -top-1 end-[-0.25rem] size-2 rounded-full ring-2"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
