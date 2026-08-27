"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Switch } from "@workspace/ui/components/switch"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import { aedToFils, filsToAed } from "@/lib/money"

export type ExitOfferValue = {
  enabled: boolean
  percent: number
  minutes: number
  minSubtotalFils: number
}

export type AbandonedEmailValue = {
  enabled: boolean
  percent: number
  delayMinutes: number
  couponHours: number
  minSubtotalFils: number
}

type Props = {
  exitOffer: ExitOfferValue
  abandonedEmail: AbandonedEmailValue
}

/**
 * The two cart-recovery levers in one panel, because the shop owner thinks of
 * them together: the discount offered on the way out of checkout, and the one
 * emailed to whoever left anyway.
 *
 * Each switch saves on toggle (a toggle is its own decision); the number fields
 * batch into the shared save bar. `minSubtotalFils` isn't surfaced — it's
 * carried through untouched so a value set elsewhere survives a save here.
 */
export function RecoveryForm({ exitOffer, abandonedEmail }: Props) {
  const t = useTranslations("admin.settings.recovery")

  const [offerEnabled, setOfferEnabled] = useState(exitOffer.enabled)
  const [emailEnabled, setEmailEnabled] = useState(abandonedEmail.enabled)
  const [pendingToggle, startToggleTransition] = useTransition()
  const [pendingSave, startSaveTransition] = useTransition()

  // Thresholds are edited in AED and stored in fils, like the coupon form.
  const [saved, setSaved] = useState({
    offerPercent: String(exitOffer.percent),
    offerMinutes: String(exitOffer.minutes),
    offerMinAed: String(filsToAed(exitOffer.minSubtotalFils)),
    emailPercent: String(abandonedEmail.percent),
    emailDelay: String(abandonedEmail.delayMinutes),
    emailHours: String(abandonedEmail.couponHours),
    emailMinAed: String(filsToAed(abandonedEmail.minSubtotalFils)),
  })
  const [draft, setDraft] = useState(saved)

  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some(
    (key) => saved[key] !== draft[key],
  )

  const set = (key: keyof typeof saved) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  function toggle(which: "offer" | "email", checked: boolean) {
    startToggleTransition(async () => {
      const res =
        which === "offer"
          ? await updateSettingsAction({
              key: "checkout.exit_offer",
              value: {
                ...exitOffer,
                percent: Number(draft.offerPercent) || exitOffer.percent,
                minutes: Number(draft.offerMinutes) || exitOffer.minutes,
                minSubtotalFils: aedToFils(Number(draft.offerMinAed) || 0),
                enabled: checked,
              },
            })
          : await updateSettingsAction({
              key: "checkout.abandoned_email",
              value: {
                ...abandonedEmail,
                percent: Number(draft.emailPercent),
                delayMinutes:
                  Number(draft.emailDelay) || abandonedEmail.delayMinutes,
                couponHours:
                  Number(draft.emailHours) || abandonedEmail.couponHours,
                minSubtotalFils: aedToFils(Number(draft.emailMinAed) || 0),
                enabled: checked,
              },
            })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (which === "offer") setOfferEnabled(checked)
      else setEmailEnabled(checked)
      toast.success(t("saved_toast"))
    })
  }

  function save() {
    const offerPercent = Math.floor(Number(draft.offerPercent))
    const offerMinutes = Math.floor(Number(draft.offerMinutes))
    const emailPercent = Math.floor(Number(draft.emailPercent))
    const emailDelay = Math.floor(Number(draft.emailDelay))
    const emailHours = Math.floor(Number(draft.emailHours))
    const offerMinAed = Number(draft.offerMinAed)
    const emailMinAed = Number(draft.emailMinAed)

    if (!(offerPercent >= 1 && offerPercent <= 100)) {
      toast.error(t("percent_range_error"))
      return
    }
    if (!(emailPercent >= 0 && emailPercent <= 100)) {
      toast.error(t("email_percent_range_error"))
      return
    }
    if (!(offerMinutes >= 1 && offerMinutes <= 1440)) {
      toast.error(t("minutes_range_error"))
      return
    }
    if (!(emailDelay >= 5 && emailDelay <= 10080)) {
      toast.error(t("delay_range_error"))
      return
    }
    if (!(emailHours >= 1 && emailHours <= 720)) {
      toast.error(t("hours_range_error"))
      return
    }
    if (
      !Number.isFinite(offerMinAed) ||
      offerMinAed < 0 ||
      !Number.isFinite(emailMinAed) ||
      emailMinAed < 0
    ) {
      toast.error(t("threshold_range_error"))
      return
    }

    const snapshot = draft
    startSaveTransition(async () => {
      const results = await Promise.all([
        updateSettingsAction({
          key: "checkout.exit_offer",
          value: {
            ...exitOffer,
            enabled: offerEnabled,
            percent: offerPercent,
            minutes: offerMinutes,
            minSubtotalFils: aedToFils(offerMinAed),
          },
        }),
        updateSettingsAction({
          key: "checkout.abandoned_email",
          value: {
            enabled: emailEnabled,
            percent: emailPercent,
            delayMinutes: emailDelay,
            couponHours: emailHours,
            minSubtotalFils: aedToFils(emailMinAed),
          },
        }),
      ])
      const failed = results.find((res) => !res.ok)
      if (failed && !failed.ok) {
        toast.error(failed.error)
        return
      }
      setSaved(snapshot)
      toast.success(t("saved_toast"))
    })
  }

  useSaveBar("settings-recovery", {
    dirty,
    saving: pendingSave,
    save,
    discard: () => setDraft(saved),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="space-y-8"
    >
      {/* ── Exit offer ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-start gap-4">
          <Switch
            id="exit-offer-switch"
            checked={offerEnabled}
            onCheckedChange={(checked) => toggle("offer", checked)}
            disabled={pendingToggle}
          />
          <div className="space-y-1">
            <Label htmlFor="exit-offer-switch" className="text-sm font-medium">
              {t("offer_label")}
            </Label>
            <p className="text-muted-foreground text-xs">
              {t("offer_description")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="exit-offer-percent"
            label={t("offer_percent_label")}
            help={t("offer_percent_help")}
            suffix="%"
            min={1}
            max={100}
            value={draft.offerPercent}
            onChange={set("offerPercent")}
          />
          <NumberField
            id="exit-offer-minutes"
            label={t("offer_minutes_label")}
            help={t("offer_minutes_help")}
            suffix={t("minutes_suffix")}
            min={1}
            max={1440}
            value={draft.offerMinutes}
            onChange={set("offerMinutes")}
          />
          <NumberField
            id="exit-offer-min"
            label={t("threshold_label")}
            help={t("offer_threshold_help")}
            suffix={t("aed_suffix")}
            min={0}
            max={1000000}
            value={draft.offerMinAed}
            onChange={set("offerMinAed")}
          />
        </div>
      </section>

      <Separator />

      {/* ── Recovery email ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-start gap-4">
          <Switch
            id="abandoned-email-switch"
            checked={emailEnabled}
            onCheckedChange={(checked) => toggle("email", checked)}
            disabled={pendingToggle}
          />
          <div className="space-y-1">
            <Label
              htmlFor="abandoned-email-switch"
              className="text-sm font-medium"
            >
              {t("email_label")}
            </Label>
            <p className="text-muted-foreground text-xs">
              {t("email_description")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            id="abandoned-email-percent"
            label={t("email_percent_label")}
            help={t("email_percent_help")}
            suffix="%"
            min={0}
            max={100}
            value={draft.emailPercent}
            onChange={set("emailPercent")}
          />
          <NumberField
            id="abandoned-email-delay"
            label={t("email_delay_label")}
            help={t("email_delay_help")}
            suffix={t("minutes_suffix")}
            min={5}
            max={10080}
            value={draft.emailDelay}
            onChange={set("emailDelay")}
          />
          <NumberField
            id="abandoned-email-hours"
            label={t("email_hours_label")}
            help={t("email_hours_help")}
            suffix={t("hours_suffix")}
            min={1}
            max={720}
            value={draft.emailHours}
            onChange={set("emailHours")}
          />
          <NumberField
            id="abandoned-email-min"
            label={t("threshold_label")}
            help={t("email_threshold_help")}
            suffix={t("aed_suffix")}
            min={0}
            max={1000000}
            value={draft.emailMinAed}
            onChange={set("emailMinAed")}
          />
        </div>
      </section>
    </form>
  )
}

function NumberField({
  id,
  label,
  help,
  suffix,
  min,
  max,
  value,
  onChange,
}: {
  id: string
  label: string
  help: string
  suffix: string
  min: number
  max: number
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          className="w-28"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-muted-foreground text-sm">{suffix}</span>
      </div>
      <p className="text-muted-foreground text-xs">{help}</p>
    </div>
  )
}
