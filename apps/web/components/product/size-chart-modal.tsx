"use client"

import { useTranslations } from "next-intl"
import { Ruler } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"

import type { Locale } from "@/lib/locale"

import {
  SizeChartView,
  type SizeChartRow,
  type SizeChartUnit,
} from "./size-chart-view"

export type { SizeChartRow, SizeChartUnit } from "./size-chart-view"

type Props = {
  unit: SizeChartUnit
  rows: SizeChartRow[]
  locale: Locale
}

/**
 * Size chart trigger + dialog. Server-passed `{ unit, rows }` is the source of
 * truth for numbers; the storefront lets shoppers toggle the display unit.
 */
export function SizeChartModal({ unit, rows, locale }: Props) {
  const t = useTranslations("product")

  if (rows.length === 0) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto p-0 text-sm">
          <Ruler className="me-1.5 size-4" />
          {t("size_chart")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto md:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-center">
            {t("size_chart_heading")}
          </DialogTitle>
        </DialogHeader>
        <SizeChartView unit={unit} rows={rows} locale={locale} />
      </DialogContent>
    </Dialog>
  )
}
