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
  freeShippingEnabled: boolean
  flat: string
  threshold: string
  /** Per-kilogram surcharge, in AED. */
  perKg: string
  /** Free-weight allowance, in kilograms. */
  weightThreshold: string
  minDays: string
  maxDays: string
}

function toRows(config: ShippingConfig): Row[] {
  return config.countries.map((c) => ({
    country: c.country,
    enabled: c.enabled,
    freeShippingEnabled: c.freeShippingEnabled,
    flat: String(filsToAed(c.flatFils)),
    threshold: String(filsToAed(c.freeThresholdFils)),
    perKg: String(filsToAed(c.perKgFils)),
    weightThreshold: String(c.weightThresholdGrams / 1000),
    minDays: String(c.minDays),
    maxDays: String(c.maxDays),
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
      const perKg = Number(r.perKg)
      const weightThreshold = Number(r.weightThreshold)
      const minDays = Number(r.minDays)
      const maxDays = Number(r.maxDays)
      if (
        !Number.isFinite(flat) ||
        flat < 0 ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        !Number.isFinite(perKg) ||
        perKg < 0 ||
        !Number.isFinite(weightThreshold) ||
        weightThreshold < 0 ||
        !Number.isInteger(minDays) ||
        minDays < 0 ||
        !Number.isInteger(maxDays) ||
        maxDays < 0 ||
        maxDays < minDays
      ) {
        toast.error(t("markets.invalid"))
        return
      }
    }

    const value: ShippingConfig = {
      countries: rows.map((r) => ({
        country: r.country,
        enabled: r.enabled,
        freeShippingEnabled: r.freeShippingEnabled,
        flatFils: aedToFils(Number(r.flat)),
        freeThresholdFils: aedToFils(Number(r.threshold)),
        perKgFils: aedToFils(Number(r.perKg)),
        weightThresholdGrams: Math.round(Number(r.weightThreshold) * 1000),
        minDays: Math.floor(Number(r.minDays)),
        maxDays: Math.floor(Number(r.maxDays)),
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
          className="space-y-3 rounded-md border p-3"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <label className="flex items-center gap-2 py-1">
                <Checkbox
                  checked={r.freeShippingEnabled}
                  disabled={!r.enabled}
                  onCheckedChange={(v) =>
                    update(i, { freeShippingEnabled: v === true })
                  }
                />
                <span className="text-muted-foreground text-xs">
                  {t("markets.free_shipping_enabled_label")}
                </span>
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={r.threshold}
                disabled={!r.enabled || !r.freeShippingEnabled}
                onChange={(e) => update(i, { threshold: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>{t("markets.per_kg_label")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={r.perKg}
                disabled={!r.enabled}
                onChange={(e) => update(i, { perKg: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>{t("markets.weight_threshold_label")}</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={r.weightThreshold}
                disabled={!r.enabled}
                onChange={(e) => update(i, { weightThreshold: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>{t("markets.min_days_label")}</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={r.minDays}
                disabled={!r.enabled}
                onChange={(e) => update(i, { minDays: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label>{t("markets.max_days_label")}</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={r.maxDays}
                disabled={!r.enabled}
                onChange={(e) => update(i, { maxDays: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
      <p className="text-muted-foreground text-xs">{t("markets.help")}</p>
    </form>
  )
}
