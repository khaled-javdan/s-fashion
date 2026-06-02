"use client"

import { Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
type Unit = SizeChart["unit"]

type FormRow = {
  size: string
  shoulder: string
  bust: string
  waist: string
  hips: string
  sleeves: string
  length: string
}

function toFormRow(row: Row): FormRow {
  return {
    size: row.size,
    shoulder: row.shoulder == null ? "" : String(row.shoulder),
    bust: row.bust == null ? "" : String(row.bust),
    waist: row.waist == null ? "" : String(row.waist),
    hips: row.hips == null ? "" : String(row.hips),
    sleeves: row.sleeves == null ? "" : String(row.sleeves),
    length: String(row.length),
  }
}

type Props = {
  chart: SizeChart | null
}

const EMPTY_ROW: FormRow = {
  size: "",
  shoulder: "",
  bust: "",
  waist: "",
  hips: "",
  sleeves: "",
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
  const [savedUnit, setSavedUnit] = useState<Unit>(chart?.unit ?? "in")
  const [unit, setUnit] = useState<Unit>(savedUnit)
  const [pending, startTransition] = useTransition()

  const dirty =
    unit !== savedUnit || JSON.stringify(rows) !== JSON.stringify(savedRows)

  const update = (index: number, patch: Partial<FormRow>) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const add = () => setRows((rs) => [...rs, { ...EMPTY_ROW }])
  const remove = (index: number) =>
    setRows((rs) => rs.filter((_, i) => i !== index))

  // Decimals allowed (e.g. inches at .5 increments). Empty cells stay null.
  const parseMeasure = (value: string): number | null => {
    if (value.trim() === "") return null
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const save = () => {
    const parsedRows: Row[] = []
    for (const r of rows) {
      if (r.size.trim() === "") {
        toast.error(t("size_chart.size_required_error"))
        return
      }
      const length = Number(r.length)
      if (!Number.isFinite(length) || length < 0) {
        toast.error(t("size_chart.length_error", { size: r.size }))
        return
      }
      parsedRows.push({
        size: r.size.trim(),
        shoulder: parseMeasure(r.shoulder),
        bust: parseMeasure(r.bust),
        waist: parseMeasure(r.waist),
        hips: parseMeasure(r.hips),
        sleeves: parseMeasure(r.sleeves),
        length,
      })
    }

    const value: SizeChart = { unit, rows: parsedRows }
    const snapshotRows = rows
    const snapshotUnit = unit
    startTransition(async () => {
      const result = await updateSettingsAction({
        key: "size_chart.cm",
        value,
      })
      if (result.ok) {
        setSavedRows(snapshotRows)
        setSavedUnit(snapshotUnit)
        toast.success(t("size_chart.saved_toast"))
      } else {
        toast.error(result.error)
      }
    })
  }

  const discard = () => {
    setRows(savedRows)
    setUnit(savedUnit)
  }

  useSaveBar("settings-size-chart", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium" htmlFor="settings-size-chart-unit">
          {t("size_chart.unit_label")}
        </label>
        <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
          <SelectTrigger id="settings-size-chart-unit" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in">{t("size_chart.unit_in")}</SelectItem>
            <SelectItem value="cm">{t("size_chart.unit_cm")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("size_chart.col_size")}</TableHead>
              <TableHead>{t("size_chart.col_shoulder")}</TableHead>
              <TableHead>{t("size_chart.col_bust")}</TableHead>
              <TableHead>{t("size_chart.col_waist")}</TableHead>
              <TableHead>{t("size_chart.col_hips")}</TableHead>
              <TableHead>{t("size_chart.col_sleeves")}</TableHead>
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
      step="any"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-20 tabular-nums"
    />
  )
}
