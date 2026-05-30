"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import { BASE_CURRENCY, CURRENCY_CODES, type CurrencyCode } from "@/lib/currency"
import { effectiveRate, type CurrencyConfig } from "@/lib/currency-config"

type Row = {
  currency: CurrencyCode
  enabled: boolean
  /** Manual AED→currency rate, held as a string. */
  rate: string
}

function toRows(config: CurrencyConfig): Row[] {
  return CURRENCY_CODES.map((c) => ({
    currency: c,
    enabled: c === BASE_CURRENCY || config.enabled.includes(c),
    rate: c === BASE_CURRENCY ? "1" : String(effectiveRate(config, c)),
  }))
}

/**
 * Currency settings: which display currencies are offered and the manual
 * AED→currency rate for each. AED is the base (fixed at 1, always enabled).
 */
export function CurrencyForm({ initial }: { initial: CurrencyConfig }) {
  const t = useTranslations("admin.settings")
  const tc = useTranslations("currency")
  const [saved, setSaved] = useState<Row[]>(() => toRows(initial))
  const [rows, setRows] = useState<Row[]>(saved)
  const [pending, startTransition] = useTransition()

  const dirty = JSON.stringify(rows) !== JSON.stringify(saved)

  const update = (index: number, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    )

  const save = () => {
    const enabled: CurrencyCode[] = []
    const rates: Partial<Record<CurrencyCode, number>> = {}
    for (const r of rows) {
      if (r.currency === BASE_CURRENCY) {
        enabled.push(r.currency)
        continue
      }
      if (!r.enabled) continue
      const rate = Number(r.rate)
      if (!Number.isFinite(rate) || rate <= 0) {
        toast.error(t("currency.invalid"))
        return
      }
      enabled.push(r.currency)
      rates[r.currency] = rate
    }

    const value: CurrencyConfig = { enabled, rates }
    const snapshot = rows
    startTransition(async () => {
      const res = await updateSettingsAction({ key: "currency.config", value })
      if (res.ok) {
        setSaved(snapshot)
        toast.success(t("currency.saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  const discard = () => setRows(saved)

  useSaveBar("settings-currency", { dirty, saving: pending, save, discard })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="space-y-3"
    >
      {rows.map((r, i) => {
        const isBase = r.currency === BASE_CURRENCY
        return (
          <div
            key={r.currency}
            className="grid grid-cols-1 items-end gap-3 rounded-md border p-3 sm:grid-cols-[12rem_1fr]"
          >
            <label className="flex items-center gap-2">
              <Checkbox
                checked={r.enabled}
                disabled={isBase}
                onCheckedChange={(v) => update(i, { enabled: v === true })}
              />
              <span className="text-sm font-medium">
                {r.currency} — {tc(r.currency)}
              </span>
            </label>
            <div className="grid gap-1">
              <Label>{t("currency.rate_label")}</Label>
              <Input
                type="number"
                min={0}
                step="0.0001"
                value={r.rate}
                disabled={isBase || !r.enabled}
                onChange={(e) => update(i, { rate: e.target.value })}
              />
            </div>
          </div>
        )
      })}
      <p className="text-muted-foreground text-xs">{t("currency.help")}</p>
    </form>
  )
}
