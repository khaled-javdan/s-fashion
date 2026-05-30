"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"

type Props = {
  maxItems: number
  maxQtyPerVariant: number
}

export function AntiAbuseForm({ maxItems, maxQtyPerVariant }: Props) {
  const t = useTranslations("admin.settings")
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState({
    items: String(maxItems),
    qty: String(maxQtyPerVariant),
  })
  const [items, setItems] = useState(saved.items)
  const [qty, setQty] = useState(saved.qty)
  const [pending, startTransition] = useTransition()

  const dirty = items !== saved.items || qty !== saved.qty

  const save = () => {
    const itemsNum = Math.floor(Number(items))
    const qtyNum = Math.floor(Number(qty))
    if (!Number.isFinite(itemsNum) || itemsNum < 1) {
      toast.error(t("limits.max_items_min_error"))
      return
    }
    if (!Number.isFinite(qtyNum) || qtyNum < 1) {
      toast.error(t("limits.max_qty_min_error"))
      return
    }

    const snapshot = { items, qty }
    startTransition(async () => {
      const results = await Promise.all([
        updateSettingsAction({ key: "order.max_items", value: itemsNum }),
        updateSettingsAction({
          key: "order.max_qty_per_variant",
          value: qtyNum,
        }),
      ])
      const failed = results.find((r) => !r.ok)
      if (failed && !failed.ok) {
        toast.error(failed.error)
      } else {
        setSaved(snapshot)
        toast.success(t("limits.saved_toast"))
      }
    })
  }

  const discard = () => {
    setItems(saved.items)
    setQty(saved.qty)
  }

  useSaveBar("settings-limits", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("limits.max_items_label")}</Label>
          <Input
            type="number"
            min={1}
            value={items}
            onChange={(e) => setItems(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("limits.max_qty_label")}</Label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
      </div>
    </form>
  )
}
