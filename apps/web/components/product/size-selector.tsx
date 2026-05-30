"use client"

import { cn } from "@workspace/ui/lib/utils"

export type SizeOption = {
  size: string
  /** Whether this size is available (in stock) for the current color selection. */
  available: boolean
}

type Props = {
  options: SizeOption[]
  selected: string | null
  onSelect: (size: string) => void
}

/**
 * Row of size buttons. Out-of-stock sizes for the current color are visually
 * disabled (not removed) and cannot be selected. Uses `aria-pressed`.
 */
export function SizeSelector({ options, selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option.size === selected
        return (
          <button
            key={option.size}
            type="button"
            aria-pressed={isSelected}
            disabled={!option.available}
            onClick={() => onSelect(option.size)}
            className={cn(
              "min-w-12 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isSelected
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground/60",
              !option.available &&
                "text-muted-foreground/50 cursor-not-allowed line-through opacity-50 hover:border-border",
            )}
          >
            {option.size}
          </button>
        )
      })}
    </div>
  )
}
