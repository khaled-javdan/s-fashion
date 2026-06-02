"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { cn } from "@workspace/ui/lib/utils"

import type { Locale } from "@/lib/locale"

export type SizeChartRow = {
  size: string
  shoulder: number | null
  bust: number | null
  waist: number | null
  hips: number | null
  sleeves: number | null
  length: number
}

export type SizeChartUnit = "in" | "cm"

type Props = {
  /** The unit the stored numbers are in. */
  unit: SizeChartUnit
  rows: SizeChartRow[]
  locale: Locale
  /** If true, defer the diagram + measurement guide to a parent. */
  hideGuide?: boolean
}

const IN_TO_CM = 2.54

function convert(value: number, from: SizeChartUnit, to: SizeChartUnit): number {
  if (from === to) return value
  if (from === "in" && to === "cm") return value * IN_TO_CM
  return value / IN_TO_CM
}

/**
 * Body-fit size chart with a unit toggle, body-diagram callouts, and the
 * numbered measurement guide. Shared by the size-chart modal and the size-chart
 * product tab so both renderings stay in sync.
 */
export function SizeChartView({ unit, rows, locale, hideGuide = false }: Props) {
  const t = useTranslations("product")
  const [display, setDisplay] = useState<SizeChartUnit>("in")

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    maximumFractionDigits: 1,
  })
  const cell = (value: number | null) => {
    if (value == null) return "—"
    const converted = convert(value, unit, display)
    return nf.format(converted)
  }
  const unitWord =
    display === "in" ? t("size_chart_unit_inches") : t("size_chart_unit_cm")

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-center text-sm">
        {t("size_chart_intro", { unit: unitWord })}
      </p>

      {/* INCHES | CM toggle */}
      <div
        role="radiogroup"
        aria-label={t("size_chart_unit_toggle_aria")}
        className="flex justify-center gap-1 text-xs font-medium tracking-wide"
      >
        <button
          type="button"
          role="radio"
          aria-checked={display === "in"}
          onClick={() => setDisplay("in")}
          className={cn(
            "px-2 py-1 transition",
            display === "in"
              ? "text-primary underline underline-offset-4"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("size_chart_unit_inches")}
        </button>
        <span aria-hidden className="text-muted-foreground">|</span>
        <button
          type="button"
          role="radio"
          aria-checked={display === "cm"}
          onClick={() => setDisplay("cm")}
          className={cn(
            "px-2 py-1 transition",
            display === "cm"
              ? "text-primary underline underline-offset-4"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("size_chart_unit_cm")}
        </button>
      </div>

      {/* Tablet & up: classic 7-column table. */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-border bg-muted/40 border-b text-start">
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_size")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_shoulder")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_bust")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_waist")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_hips")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_sleeves")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_length")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.size} className="border-border/60 border-b">
                <td className="px-3 py-2 font-medium">{row.size}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.shoulder)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.bust)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.waist)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.hips)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.sleeves)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.length)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per size with measurements stacked — no horizontal
          scroll, no truncation. Each label/value pair is a definition row. */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => {
          const measurements: Array<[string, number | null]> = [
            [t("size_chart_shoulder"), row.shoulder],
            [t("size_chart_bust"), row.bust],
            [t("size_chart_waist"), row.waist],
            [t("size_chart_hips"), row.hips],
            [t("size_chart_sleeves"), row.sleeves],
            [t("size_chart_length"), row.length],
          ]
          return (
            <div
              key={row.size}
              className="rounded-md border p-3 text-sm"
            >
              <div className="bg-muted/40 -mx-3 -mt-3 mb-2 rounded-t-md border-b px-3 py-2 font-medium">
                {t("size_chart_size")}: <span className="font-semibold">{row.size}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {measurements.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums font-medium">{cell(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>

      {!hideGuide ? <MeasurementGuide /> : null}
    </div>
  )
}

/**
 * The numbered measurement bullets + the body diagram. Static for everyone —
 * lives here so both the modal and the size-chart tab share the same copy.
 * The diagram itself is a static asset under `/public`; if it's missing the
 * `<img>` simply renders its alt text.
 */
export function MeasurementGuide() {
  const t = useTranslations("product")
  const items = [
    t("size_chart_guide_length"),
    t("size_chart_guide_chest"),
    t("size_chart_guide_hip"),
    t("size_chart_guide_waist"),
    t("size_chart_guide_armhole"),
    t("size_chart_guide_wrist"),
    t("size_chart_guide_sleeve"),
    t("size_chart_guide_bottom"),
  ]
  return (
    <div className="space-y-4 pt-4">
      <ol className="text-muted-foreground space-y-2 text-sm">
        {items.map((text, i) => (
          <li key={i} className="leading-relaxed">
            <span className="text-foreground me-1 font-medium">{i + 1}.</span>
            {text}
          </li>
        ))}
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- static public asset, no need for Image optimisation */}
      <img
        src="/size-chart-diagram.jpeg"
        alt={t("size_chart_diagram_alt")}
        className="mx-auto block max-h-[420px] w-auto"
      />
    </div>
  )
}
