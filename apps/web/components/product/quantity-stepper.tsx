"use client"

import { useTranslations } from "next-intl"
import { Minus, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

type Props = {
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (value: number) => void
}

/** Compact −/＋ quantity stepper, clamped to [min, max]. */
export function QuantityStepper({
  value,
  min,
  max,
  disabled = false,
  onChange,
}: Props) {
  const t = useTranslations("product")

  function clamp(next: number): number {
    return Math.max(min, Math.min(max, next))
  }

  return (
    <div className="border-border inline-flex w-fit items-center rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || value <= min}
        aria-label={t("quantity_label")}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus className="size-4" />
      </Button>
      <span
        className="min-w-10 text-center text-sm tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || value >= max}
        aria-label={t("quantity_label")}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}
