"use client"

import { useTranslations } from "next-intl"
import { Ruler } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"

export type SizeChartRow = {
  size: string
  bust: number | null
  waist: number | null
  hips: number | null
  length: number
}

type Props = {
  rows: SizeChartRow[]
}

/**
 * Size chart trigger + dialog. Data (centimetre measurements) is read from the
 * `size_chart.cm` setting server-side and passed in.
 */
export function SizeChartModal({ rows }: Props) {
  const t = useTranslations("product")

  if (rows.length === 0) return null

  const cell = (value: number | null) => (value == null ? "—" : value)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto p-0 text-sm">
          <Ruler className="me-1.5 size-4" />
          {t("size_chart")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("size_chart_heading")}</DialogTitle>
          <DialogDescription>{t("size_chart_unit")}</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-border border-b text-start">
                <th className="py-2 ps-0 pe-3 text-start font-medium">
                  {t("size_chart_size")}
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
                  {t("size_chart_length")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.size} className="border-border/60 border-b">
                  <td className="py-2 ps-0 pe-3 font-medium">{row.size}</td>
                  <td className="px-3 py-2 tabular-nums">{cell(row.bust)}</td>
                  <td className="px-3 py-2 tabular-nums">{cell(row.waist)}</td>
                  <td className="px-3 py-2 tabular-nums">{cell(row.hips)}</td>
                  <td className="px-3 py-2 tabular-nums">{cell(row.length)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
