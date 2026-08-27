"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@workspace/ui/components/button"

import { DateRangePicker } from "@/components/admin/analytics/date-range-picker"

type Preset = { days: number; label: string }

type Props = {
  presets: Preset[]
  /** Active preset length, or null when a custom range is in effect. */
  activeDays: number | null
  /** Resolved window, used to prefill the custom date inputs (YYYY-MM-DD). */
  from: string
  to: string
  labels: { apply: string; pick: string }
  /** URL search-param names. Defaults to range/from/to. Override when
   *  multiple range pickers share the same page to avoid collisions. */
  paramKeys?: { range: string; from: string; to: string }
}

/**
 * Period selector for the analytics section: today/7/30/90-day presets plus a
 * custom from–to date range. Selection lives in the URL (`?range=` or
 * `?from=&to=`) so the server re-queries and the view is shareable.
 */
export function AnalyticsRangeControls({
  presets,
  activeDays,
  from,
  to,
  labels,
  paramKeys = { range: "range", from: "from", to: "to" },
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const navigate = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`))
  }

  const choosePreset = (days: number) =>
    navigate({
      [paramKeys.range]: String(days),
      [paramKeys.from]: null,
      [paramKeys.to]: null,
    })

  const applyCustom = (range: { from: string; to: string }) =>
    navigate({
      [paramKeys.from]: range.from,
      [paramKeys.to]: range.to,
      [paramKeys.range]: null,
    })

  const customActive = activeDays === null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        {presets.map((p) => (
          <Button
            key={p.days}
            type="button"
            size="xs"
            variant={!customActive && activeDays === p.days ? "default" : "outline"}
            disabled={pending}
            onClick={() => choosePreset(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <DateRangePicker
        from={from}
        to={to}
        active={customActive}
        disabled={pending}
        labels={labels}
        onApply={applyCustom}
      />
    </div>
  )
}
