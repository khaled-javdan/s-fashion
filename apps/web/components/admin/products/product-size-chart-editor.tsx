"use client"

import { Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

/** A size-chart row as edited in the form (all string-backed inputs). */
export type SizeChartFormRow = {
  size: string
  shoulder: string
  bust: string
  waist: string
  hips: string
  sleeves: string
  length: string
}

export type SizeChartFormUnit = "in" | "cm"

/** The complete per-product chart override (unit + rows), or `null` to defer. */
export type SizeChartFormState = {
  unit: SizeChartFormUnit
  rows: SizeChartFormRow[]
} | null

export const EMPTY_SIZE_CHART_ROW: SizeChartFormRow = {
  size: "",
  shoulder: "",
  bust: "",
  waist: "",
  hips: "",
  sleeves: "",
  length: "",
}

type Props = {
  /**
   * `null` means "use the global default" (the override is off). An object
   * `{ unit, rows }` means the per-product override is on. The parent owns
   * this state so the save bar can diff it like the rest of the form.
   */
  chart: SizeChartFormState
  onChange: (chart: SizeChartFormState) => void
}

/**
 * Per-product size chart editor. A "Use global default" switch toggles the
 * override on (seeding one empty row in inches) / off (clearing to `null`).
 * When on, the admin picks a unit (inches or centimetres) and edits
 * size/shoulder/bust/waist/hips/sleeves/length rows.
 */
export function ProductSizeChartEditor({ chart, onChange }: Props) {
  const t = useTranslations("admin.products.size_chart")
  const enabled = chart !== null

  const toggle = (on: boolean) =>
    onChange(on ? { unit: "in", rows: [{ ...EMPTY_SIZE_CHART_ROW }] } : null)

  const setUnit = (unit: SizeChartFormUnit) => {
    if (!chart) return
    onChange({ ...chart, unit })
  }

  const update = (index: number, patch: Partial<SizeChartFormRow>) => {
    if (!chart) return
    onChange({
      ...chart,
      rows: chart.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    })
  }
  const add = () => {
    if (!chart) return
    onChange({ ...chart, rows: [...chart.rows, { ...EMPTY_SIZE_CHART_ROW }] })
  }
  const remove = (index: number) => {
    if (!chart) return
    onChange({ ...chart, rows: chart.rows.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={(v) => toggle(!v)} />
        <div>
          <div className="text-sm font-medium">{t("use_global")}</div>
          <div className="text-muted-foreground text-xs">
            {t("use_global_desc")}
          </div>
        </div>
      </div>

      {enabled && chart ? (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" htmlFor="size-chart-unit">
              {t("unit_label")}
            </label>
            <Select value={chart.unit} onValueChange={(v) => setUnit(v as SizeChartFormUnit)}>
              <SelectTrigger id="size-chart-unit" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">{t("unit_in")}</SelectItem>
                <SelectItem value="cm">{t("unit_cm")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col_size")}</TableHead>
                  <TableHead>{t("col_shoulder")}</TableHead>
                  <TableHead>{t("col_bust")}</TableHead>
                  <TableHead>{t("col_waist")}</TableHead>
                  <TableHead>{t("col_hips")}</TableHead>
                  <TableHead>{t("col_sleeves")}</TableHead>
                  <TableHead>{t("col_length")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {chart.rows.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={r.size}
                        onChange={(e) => update(idx, { size: e.target.value })}
                        placeholder="S"
                        aria-label={t("size_label_aria")}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <MeasureInput
                        value={r.shoulder}
                        onChange={(v) => update(idx, { shoulder: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <MeasureInput
                        value={r.bust}
                        onChange={(v) => update(idx, { bust: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <MeasureInput
                        value={r.waist}
                        onChange={(v) => update(idx, { waist: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <MeasureInput
                        value={r.hips}
                        onChange={(v) => update(idx, { hips: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <MeasureInput
                        value={r.sleeves}
                        onChange={(v) => update(idx, { sleeves: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <MeasureInput
                        value={r.length}
                        onChange={(v) => update(idx, { length: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                        disabled={chart.rows.length <= 1}
                        aria-label={t("remove_row_aria")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="h-4 w-4" />
              {t("add_row")}
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">{t("blank_hint")}</p>
        </>
      ) : null}
    </div>
  )
}

function MeasureInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-20 tabular-nums"
    />
  )
}
