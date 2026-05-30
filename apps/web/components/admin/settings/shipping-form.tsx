"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import { aedToFils, filsToAed } from "@/lib/money"

type Props = {
  flatFils: number
  freeThresholdFils: number
}

export function ShippingForm({ flatFils, freeThresholdFils }: Props) {
  const t = useTranslations("admin.settings")
  // Baseline the form diffs against. A server action's revalidatePath does not
  // refresh a mounted client form's props, so we advance this snapshot locally
  // on each successful save to clear the unsaved-changes state.
  const [saved, setSaved] = useState({
    flat: String(filsToAed(flatFils)),
    threshold: String(filsToAed(freeThresholdFils)),
  })
  const [flat, setFlat] = useState(saved.flat)
  const [threshold, setThreshold] = useState(saved.threshold)
  const [pending, startTransition] = useTransition()

  const dirty = flat !== saved.flat || threshold !== saved.threshold

  const save = () => {
    const flatNum = Number(flat)
    const thresholdNum = Number(threshold)
    if (!Number.isFinite(flatNum) || flatNum < 0) {
      toast.error(t("shipping.flat_fee_error"))
      return
    }
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0) {
      toast.error(t("shipping.threshold_error"))
      return
    }

    const snapshot = { flat, threshold }
    startTransition(async () => {
      const r1 = await updateSettingsAction({
        key: "shipping.flat_fils",
        value: aedToFils(flatNum),
      })
      const r2 = await updateSettingsAction({
        key: "shipping.free_threshold_fils",
        value: aedToFils(thresholdNum),
      })
      if (r1.ok && r2.ok) {
        setSaved(snapshot)
        toast.success(t("shipping.saved_toast"))
      } else {
        toast.error(
          (!r1.ok && r1.error) || (!r2.ok && r2.error) || t("shipping.failed"),
        )
      }
    })
  }

  const discard = () => {
    setFlat(saved.flat)
    setThreshold(saved.threshold)
  }

  useSaveBar("settings-shipping", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("shipping.flat_fee_label")}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={flat}
            onChange={(e) => setFlat(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("shipping.threshold_label")}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
      </div>
    </form>
  )
}
