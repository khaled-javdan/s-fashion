"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"

type Props = {
  whatsappEnabled: boolean
  welcomeDiscountPercent: number
}

export function MarketingForm({ whatsappEnabled, welcomeDiscountPercent }: Props) {
  const t = useTranslations("admin.settings.marketing")
  const [enabled, setEnabled] = useState(whatsappEnabled)
  const [savedDiscount, setSavedDiscount] = useState(String(welcomeDiscountPercent))
  const [discount, setDiscount] = useState(savedDiscount)
  const [pendingToggle, startToggleTransition] = useTransition()
  const [pendingDiscount, startDiscountTransition] = useTransition()

  const dirty = discount !== savedDiscount

  const toggleEnabled = (checked: boolean) => {
    startToggleTransition(async () => {
      const res = await updateSettingsAction({
        key: "marketing.whatsapp_enabled",
        value: checked,
      })
      if (res.ok) {
        setEnabled(checked)
        toast.success(t("enabled_saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  const saveDiscount = () => {
    const num = Math.floor(Number(discount))
    if (!Number.isFinite(num) || num < 1 || num > 100) {
      toast.error(t("discount_range_error"))
      return
    }
    const snapshot = discount
    startDiscountTransition(async () => {
      const res = await updateSettingsAction({
        key: "marketing.welcome_discount_percent",
        value: num,
      })
      if (res.ok) {
        setSavedDiscount(snapshot)
        toast.success(t("discount_saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  const discardDiscount = () => setDiscount(savedDiscount)

  useSaveBar("settings-marketing", {
    dirty,
    saving: pendingDiscount,
    save: saveDiscount,
    discard: discardDiscount,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Switch
          id="whatsapp-enabled-switch"
          checked={enabled}
          onCheckedChange={toggleEnabled}
          disabled={pendingToggle}
        />
        <div className="space-y-1">
          <Label htmlFor="whatsapp-enabled-switch" className="text-sm font-medium">
            {enabled ? t("enabled_label") : t("disabled_label")}
          </Label>
          <p className="text-muted-foreground text-xs">
            {enabled ? t("enabled_description") : t("disabled_description")}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          saveDiscount()
        }}
        className="space-y-2"
      >
        <Label htmlFor="welcome-discount-input">{t("discount_label")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="welcome-discount-input"
            type="number"
            min={1}
            max={100}
            className="w-28"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <span className="text-muted-foreground text-sm">%</span>
        </div>
        <p className="text-muted-foreground text-xs">{t("discount_help")}</p>
      </form>
    </div>
  )
}
