"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import {
  DESKTOP_COLS,
  MOBILE_COLS,
  TABLET_COLS,
  type GridConfig,
} from "@/lib/grid-config"

export function GridForm({ initial }: { initial: GridConfig }) {
  const t = useTranslations("admin.settings")
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState<GridConfig>(initial)
  const [config, setConfig] = useState<GridConfig>(initial)
  const [pending, startTransition] = useTransition()

  const dirty =
    config.mobile !== saved.mobile ||
    config.tablet !== saved.tablet ||
    config.desktop !== saved.desktop

  const save = () => {
    const snapshot = config
    startTransition(async () => {
      const result = await updateSettingsAction({
        key: "home.grid",
        value: snapshot,
      })
      if (result.ok) {
        setSaved(snapshot)
        toast.success(t("grid.saved_toast"))
      } else {
        toast.error(result.error)
      }
    })
  }

  const discard = () => setConfig(saved)

  useSaveBar("settings-grid", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <ColumnSelect
        label={t("grid.mobile_label")}
        value={config.mobile}
        options={MOBILE_COLS}
        onChange={(mobile) => setConfig((c) => ({ ...c, mobile }))}
      />
      <ColumnSelect
        label={t("grid.tablet_label")}
        value={config.tablet}
        options={TABLET_COLS}
        onChange={(tablet) => setConfig((c) => ({ ...c, tablet }))}
      />
      <ColumnSelect
        label={t("grid.desktop_label")}
        value={config.desktop}
        options={DESKTOP_COLS}
        onChange={(desktop) => setConfig((c) => ({ ...c, desktop }))}
      />
      <p className="text-muted-foreground text-xs sm:col-span-3">
        {t("grid.mobile_hint", {
          min: Math.min(...MOBILE_COLS),
          max: Math.max(...MOBILE_COLS),
        })}
      </p>
    </form>
  )
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: readonly number[]
  onChange: (value: number) => void
}) {
  // Radix Select speaks strings; coerce both ways at the boundary so the form
  // state stays typed as `number`.
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        value={String(value)}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
