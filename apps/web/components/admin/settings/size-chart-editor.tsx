"use client"

import { Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import type { KnownSettings } from "@/lib/repos/settings.repo"

type SizeChart = KnownSettings["size_chart.cm"]
type Row = SizeChart["rows"][number]

type FormRow = {
  size: string
  bust: string
  waist: string
  hips: string
  length: string
}

function toFormRow(row: Row): FormRow {
  return {
    size: row.size,
    bust: row.bust == null ? "" : String(row.bust),
    waist: row.waist == null ? "" : String(row.waist),
    hips: row.hips == null ? "" : String(row.hips),
    length: String(row.length),
  }
}

type Props = {
  chart: SizeChart | null
}

const EMPTY_ROW: FormRow = {
  size: "",
  bust: "",
  waist: "",
  hips: "",
  length: "",
}

export function SizeChartEditor({ chart }: Props) {
  const t = useTranslations("admin.settings")
  const initialRows: FormRow[] = chart?.rows.length
    ? chart.rows.map(toFormRow)
    : [EMPTY_ROW]
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [savedRows, setSavedRows] = useState<FormRow[]>(initialRows)
  const [rows, setRows] = useState<FormRow[]>(savedRows)
  const [pending, startTransition] = useTransition()

  const dirty = JSON.stringify(rows) !== JSON.stringify(savedRows)

  const update = (index: number, patch: Partial<FormRow>) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const add = () => setRows((rs) => [...rs, { ...EMPTY_ROW }])
  const remove = (index: number) =>
    setRows((rs) => rs.filter((_, i) => i !== index))

  const parseMeasure = (value: string): number | null => {
    if (value.trim() === "") return null
    const n = Math.floor(Number(value))
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const save = () => {
    const parsedRows: Row[] = []
    for (const r of rows) {
      if (r.size.trim() === "") {
        toast.error(t("size_chart.size_required_error"))
        return
      }
      const length = Math.floor(Number(r.length))
      if (!Number.isFinite(length) || length < 0) {
        toast.error(t("size_chart.length_error", { size: r.size }))
        return
      }
      parsedRows.push({
        size: r.size.trim(),
        bust: parseMeasure(r.bust),
        waist: parseMeasure(r.waist),
        hips: parseMeasure(r.hips),
        length,
      })
    }

    const value: SizeChart = { unit: "cm", rows: parsedRows }
    const snapshot = rows
    startTransition(async () => {
      const result = await updateSettingsAction({
        key: "size_chart.cm",
        value,
      })
      if (result.ok) {
        setSavedRows(snapshot)
        toast.success(t("size_chart.saved_toast"))
      } else {
        toast.error(result.error)
      }
    })
  }

  const discard = () => setRows(savedRows)

  useSaveBar("settings-size-chart", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("size_chart.col_size")}</TableHead>
              <TableHead>{t("size_chart.col_bust")}</TableHead>
              <TableHead>{t("size_chart.col_waist")}</TableHead>
              <TableHead>{t("size_chart.col_hips")}</TableHead>
              <TableHead>{t("size_chart.col_length")}</TableHead>
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
                    aria-label={t("size_chart.size_label_aria")}
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
                    aria-label={t("size_chart.remove_row_aria")}
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
          {t("size_chart.add_row")}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        {t("size_chart.blank_hint")}
      </p>
    </form>
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
