"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"

type Props = {
  whatsappNumber: string
  businessHoursAr: string
  businessHoursEn: string
}

export function ContactForm({
  whatsappNumber,
  businessHoursAr,
  businessHoursEn,
}: Props) {
  const t = useTranslations("admin.settings")
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState({
    whatsapp: whatsappNumber,
    hoursAr: businessHoursAr,
    hoursEn: businessHoursEn,
  })
  const [whatsapp, setWhatsapp] = useState(saved.whatsapp)
  const [hoursAr, setHoursAr] = useState(saved.hoursAr)
  const [hoursEn, setHoursEn] = useState(saved.hoursEn)
  const [pending, startTransition] = useTransition()

  const dirty =
    whatsapp !== saved.whatsapp ||
    hoursAr !== saved.hoursAr ||
    hoursEn !== saved.hoursEn

  const save = () => {
    const snapshot = { whatsapp, hoursAr, hoursEn }
    startTransition(async () => {
      const results = await Promise.all([
        updateSettingsAction({
          key: "contact.whatsapp_number",
          value: whatsapp.trim(),
        }),
        updateSettingsAction({
          key: "contact.business_hours_ar",
          value: hoursAr.trim(),
        }),
        updateSettingsAction({
          key: "contact.business_hours_en",
          value: hoursEn.trim(),
        }),
      ])
      const failed = results.find((r) => !r.ok)
      if (failed && !failed.ok) {
        toast.error(failed.error)
      } else {
        setSaved(snapshot)
        toast.success(t("contact.saved_toast"))
      }
    })
  }

  const discard = () => {
    setWhatsapp(saved.whatsapp)
    setHoursAr(saved.hoursAr)
    setHoursEn(saved.hoursEn)
  }

  useSaveBar("settings-contact", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>{t("contact.whatsapp_label")}</Label>
        <Input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="+9715XXXXXXXX"
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          {t("contact.whatsapp_help")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("contact.hours_en_label")}</Label>
          <Input
            value={hoursEn}
            onChange={(e) => setHoursEn(e.target.value)}
            placeholder="Sat–Thu, 10am – 10pm"
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("contact.hours_ar_label")}</Label>
          <Input
            dir="rtl"
            value={hoursAr}
            onChange={(e) => setHoursAr(e.target.value)}
            placeholder="السبت – الخميس، 10ص – 10م"
          />
        </div>
      </div>
    </form>
  )
}
