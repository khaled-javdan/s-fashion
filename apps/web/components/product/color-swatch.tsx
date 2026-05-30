"use client"

import { cn } from "@workspace/ui/lib/utils"

type Props = {
  /** Hex color, or null for an unstyled neutral swatch. */
  colorHex: string | null
  label: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}

/**
 * A single color swatch button. Uses `aria-pressed` for selection state and is
 * focus-visible accessible. Out-of-stock colors are dimmed but remain focusable
 * so screen-reader users can perceive them.
 */
export function ColorSwatch({
  colorHex,
  label,
  selected,
  disabled = false,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "relative size-9 rounded-full border transition focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        selected
          ? "border-foreground ring-foreground ring-2 ring-offset-2"
          : "border-border hover:border-foreground/60",
        disabled && "cursor-not-allowed opacity-30",
      )}
      style={colorHex ? { backgroundColor: colorHex } : undefined}
    >
      {!colorHex ? (
        <span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-[0.625rem] uppercase">
          {label.slice(0, 2)}
        </span>
      ) : null}
    </button>
  )
}
