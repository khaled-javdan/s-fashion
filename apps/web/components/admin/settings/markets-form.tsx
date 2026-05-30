"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import { aedToFils, filsToAed } from "@/lib/money"
import type { CountryShipping, ShippingConfig } from "@/lib/shipping-config"

/** Editable row — fees are held as AED strings and converted to fils on save. */
type Row = {
  country: CountryShipping["country"]
  enabled: boolean
  flat: string
  threshold: string
}

function toRows(config: ShippingConfig): Row[] {
  return config.countries.map((c) => ({
    country: c.country,
    enabled: c.enabled,
    flat: String(filsToAed(c.flatFils)),
    threshold: String(filsToAed(c.freeThresholdFils)),
  }))
}

/**
 * Per-country shipping editor. Each enabled country has a flat fee and a
 * free-shipping threshold, entered in base AED and stored as fils. Replaces the
 * old single-country ShippingForm.
 */
export function MarketsForm({ initial }: { initial: ShippingConfig }) {
  const t = useTranslations("admin.settings")
  const tc = useTranslations("country")
  const [saved, setSaved] = useState<Row[]>(() => toRows(initial))
  const [rows, setRows] = useState<Row[]>(saved)
  const [pending, startTransition] = useTransition()

  const dirty = JSON.stringify(rows) !== JSON.stringify(saved)

  const update = (index: number, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    )

  const save = () => {
    for (const r of rows) {
      const flat = Number(r.flat)
      const threshold = Number(r.threshold)
      if (
        !Number.isFinite(flat) ||
        flat < 0 ||
        !Number.isFinite(threshold) ||
        threshold < 0
      ) {
        toast.error(t("markets.invalid"))
        return
      }
    }

    const value: ShippingConfig = {
      countries: rows.map((r) => ({
        country: r.country,
        enabled: r.enabled,
        flatFils: aedToFils(Number(r.flat)),
        freeThresholdFils: aedToFils(Number(r.threshold)),
      })),
    }

    const snapshot = rows
    startTransition(async () => {
      const res = await updateSettingsAction({
        key: "shipping.countries",
        value,
      })
      if (res.ok) {
        setSaved(snapshot)
        toast.success(t("markets.saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  const discard = () => setRows(saved)

  useSaveBar("settings-markets", { dirty, saving: pending, save, discard })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="space-y-3"
    >
      {rows.map((r, i) => (
        <div
          key={r.country}
          className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-[10rem_1fr_1fr]"
        >
          <label className="flex items-center gap-2">
            <Checkbox
              checked={r.enabled}
              onCheckedChange={(v) => update(i, { enabled: v === true })}
            />
            <span className="text-sm font-medium">
              {tc(r.country)} · {r.country}
            </span>
          </label>
          <div className="grid gap-1">
            <Label>{t("markets.flat_label")}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={r.flat}
              disabled={!r.enabled}
              onChange={(e) => update(i, { flat: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label>{t("markets.threshold_label")}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={r.threshold}
              disabled={!r.enabled}
              onChange={(e) => update(i, { threshold: e.target.value })}
            />
          </div>
        </div>
      ))}
      <p className="text-muted-foreground text-xs">{t("markets.help")}</p>
    </form>
  )
}
