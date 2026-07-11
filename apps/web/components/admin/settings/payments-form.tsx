"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"

type Props = {
  stripeEnabled: boolean
  /** Whether STRIPE_SECRET_KEY is set on the server (env, not a setting). */
  stripeConfigured: boolean
}

export function PaymentsForm({ stripeEnabled, stripeConfigured }: Props) {
  const t = useTranslations("admin.settings.payments")
  const [enabled, setEnabled] = useState(stripeEnabled)
  const [pending, startTransition] = useTransition()

  const toggleEnabled = (checked: boolean) => {
    startTransition(async () => {
      const res = await updateSettingsAction({
        key: "payments.stripe_enabled",
        value: checked,
      })
      if (res.ok) {
        setEnabled(checked)
        toast.success(t("saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Switch
          id="stripe-enabled-switch"
          checked={enabled}
          onCheckedChange={toggleEnabled}
          disabled={pending}
        />
        <div className="space-y-1">
          <Label htmlFor="stripe-enabled-switch" className="text-sm font-medium">
            {enabled ? t("enabled_label") : t("disabled_label")}
          </Label>
          <p className="text-muted-foreground text-xs">
            {enabled ? t("enabled_description") : t("disabled_description")}
          </p>
        </div>
      </div>

      {!stripeConfigured && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t("not_configured_warning")}
        </p>
      )}

      <p className="text-muted-foreground text-xs">{t("refund_note")}</p>
    </div>
  )
}
