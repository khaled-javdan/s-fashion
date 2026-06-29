"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

type Preset = { days: number; label: string }

type Props = {
  presets: Preset[]
  /** Active preset length, or null when a custom range is in effect. */
  activeDays: number | null
  /** Resolved window, used to prefill the custom date inputs (YYYY-MM-DD). */
  from: string
  to: string
  labels: { apply: string; from: string; to: string }
  /** URL search-param names. Defaults to range/from/to. Override when
   *  multiple range pickers share the same page to avoid collisions. */
  paramKeys?: { range: string; from: string; to: string }
}

/**
 * Period selector for the analytics section: 7/30/90-day presets plus a
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
  const [fromValue, setFromValue] = useState(from)
  const [toValue, setToValue] = useState(to)

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

  const applyCustom = () => {
    if (!fromValue || !toValue) return
    navigate({
      [paramKeys.from]: fromValue,
      [paramKeys.to]: toValue,
      [paramKeys.range]: null,
    })
  }

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

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label={labels.from}
          value={fromValue}
          max={toValue || undefined}
          onChange={(e) => setFromValue(e.target.value)}
          className="h-7 w-auto px-2 py-0 text-xs"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="date"
          aria-label={labels.to}
          value={toValue}
          min={fromValue || undefined}
          onChange={(e) => setToValue(e.target.value)}
          className="h-7 w-auto px-2 py-0 text-xs"
        />
        <Button
          type="button"
          size="xs"
          variant={customActive ? "default" : "outline"}
          disabled={pending || !fromValue || !toValue}
          onClick={applyCustom}
        >
          {labels.apply}
        </Button>
      </div>
    </div>
  )
}
