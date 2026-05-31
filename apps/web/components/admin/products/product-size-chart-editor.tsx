"use client"

import { Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
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
  bust: string
  waist: string
  hips: string
  length: string
}

export const EMPTY_SIZE_CHART_ROW: SizeChartFormRow = {
  size: "",
  bust: "",
  waist: "",
  hips: "",
  length: "",
}

type Props = {
  /**
   * `null` means "use the global default" (the override is off). A row array
   * means the per-product override is on. The parent owns this state so the
   * save bar can diff it like the rest of the form.
   */
  rows: SizeChartFormRow[] | null
  onChange: (rows: SizeChartFormRow[] | null) => void
}

/**
 * Per-product size chart editor. Mirrors the global `SizeChartEditor` but is a
 * controlled component: a "Use global default" switch toggles the override on
 * (seeding one empty row) / off (clearing to `null`). When on, the admin edits
 * size/bust/waist/hips/length rows in centimetres.
 */
export function ProductSizeChartEditor({ rows, onChange }: Props) {
  const t = useTranslations("admin.products.size_chart")
  const enabled = rows !== null

  const toggle = (on: boolean) =>
    onChange(on ? [{ ...EMPTY_SIZE_CHART_ROW }] : null)

  const update = (index: number, patch: Partial<SizeChartFormRow>) => {
    if (!rows) return
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  const add = () => onChange([...(rows ?? []), { ...EMPTY_SIZE_CHART_ROW }])
  const remove = (index: number) => {
    if (!rows) return
    onChange(rows.filter((_, i) => i !== index))
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

      {enabled && rows ? (
        <>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col_size")}</TableHead>
                  <TableHead>{t("col_bust")}</TableHead>
                  <TableHead>{t("col_waist")}</TableHead>
                  <TableHead>{t("col_hips")}</TableHead>
                  <TableHead>{t("col_length")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={r.size}
                        onChange={(e) => update(idx, { size: e.target.value })}
                        placeholder="S"
                        aria-label={t("size_label_aria")}
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
                        disabled={rows.length <= 1}
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-24 tabular-nums"
    />
  )
}
