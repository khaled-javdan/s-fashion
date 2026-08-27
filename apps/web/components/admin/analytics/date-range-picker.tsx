"use client"

import { ar, enGB } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { useLocale } from "next-intl"
import { useState } from "react"
import type { DateRange } from "react-day-picker"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

/** `Date` → `YYYY-MM-DD` using local calendar parts (no UTC shift). */
function toIso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${m}-${d}`
}

/** `YYYY-MM-DD` → local-midnight `Date`, or undefined when unparseable. */
function fromIso(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

type Props = {
  /** Current window (`YYYY-MM-DD`), used to prefill the calendar. */
  from: string
  to: string
  /** Whether the custom range (rather than a preset) is what's in effect. */
  active: boolean
  disabled?: boolean
  labels: { apply: string; pick: string }
  onApply: (range: { from: string; to: string }) => void
}

/**
 * Calendar-based from–to picker: a button showing the current window that
 * opens a two-month range calendar. Nothing is committed until Apply, so the
 * caller only re-queries once the full range is chosen.
 */
export function DateRangePicker({
  from,
  to,
  active,
  disabled,
  labels,
  onApply,
}: Props) {
  const locale = useLocale()
  const isAr = locale === "ar"
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>({
    from: fromIso(from),
    to: fromIso(to),
  })

  const fmt = new Intl.DateTimeFormat(isAr ? "ar-AE" : "en-GB", {
    day: "numeric",
    month: "short",
  })

  const selectedFrom = range?.from
  const selectedTo = range?.to
  const triggerLabel =
    selectedFrom && selectedTo
      ? `${fmt.format(selectedFrom)} – ${fmt.format(selectedTo)}`
      : labels.pick

  const apply = () => {
    if (!selectedFrom || !selectedTo) return
    setOpen(false)
    onApply({ from: toIso(selectedFrom), to: toIso(selectedTo) })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Reopening after a cancelled edit should show the live window again.
        if (next) setRange({ from: fromIso(from), to: fromIso(to) })
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant={active ? "default" : "outline"}
          disabled={disabled}
        >
          <CalendarIcon data-icon="inline-start" />
          <span className="normal-case tracking-normal tabular-nums">
            {triggerLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto gap-0 p-0">
        <Calendar
          mode="range"
          autoFocus
          numberOfMonths={2}
          defaultMonth={selectedFrom}
          selected={range}
          onSelect={setRange}
          disabled={{ after: new Date() }}
          locale={isAr ? ar : enGB}
          dir={isAr ? "rtl" : "ltr"}
          className="md:[--cell-size:--spacing(9)]"
        />
        <div className="flex justify-end border-t p-3">
          <Button
            type="button"
            size="xs"
            disabled={!selectedFrom || !selectedTo}
            onClick={apply}
          >
            {labels.apply}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
