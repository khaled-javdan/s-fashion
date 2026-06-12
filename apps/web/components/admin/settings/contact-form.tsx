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
  email: string
  social: { instagram: string; tiktok: string; snapchat: string }
}

export function ContactForm({
  whatsappNumber,
  businessHoursAr,
  businessHoursEn,
  email,
  social,
}: Props) {
  const t = useTranslations("admin.settings")
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState({
    whatsapp: whatsappNumber,
    hoursAr: businessHoursAr,
    hoursEn: businessHoursEn,
    email,
    instagram: social.instagram,
    tiktok: social.tiktok,
    snapchat: social.snapchat,
  })
  const [whatsapp, setWhatsapp] = useState(saved.whatsapp)
  const [hoursAr, setHoursAr] = useState(saved.hoursAr)
  const [hoursEn, setHoursEn] = useState(saved.hoursEn)
  const [emailValue, setEmailValue] = useState(saved.email)
  const [instagram, setInstagram] = useState(saved.instagram)
  const [tiktok, setTiktok] = useState(saved.tiktok)
  const [snapchat, setSnapchat] = useState(saved.snapchat)
  const [pending, startTransition] = useTransition()

  const dirty =
    whatsapp !== saved.whatsapp ||
    hoursAr !== saved.hoursAr ||
    hoursEn !== saved.hoursEn ||
    emailValue !== saved.email ||
    instagram !== saved.instagram ||
    tiktok !== saved.tiktok ||
    snapchat !== saved.snapchat

  const save = () => {
    const snapshot = {
      whatsapp,
      hoursAr,
      hoursEn,
      email: emailValue,
      instagram,
      tiktok,
      snapchat,
    }
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
        updateSettingsAction({
          key: "contact.email",
          value: emailValue.trim(),
        }),
        updateSettingsAction({
          key: "contact.social",
          value: {
            instagram: instagram.trim(),
            tiktok: tiktok.trim(),
            snapchat: snapchat.trim(),
          },
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
    setEmailValue(saved.email)
    setInstagram(saved.instagram)
    setTiktok(saved.tiktok)
    setSnapchat(saved.snapchat)
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
      <div className="grid gap-2">
        <Label>{t("contact.email_label")}</Label>
        <Input
          type="email"
          dir="ltr"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          placeholder="support@s-fashions.com"
        />
        <p className="text-muted-foreground text-xs">
          {t("contact.email_help")}
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
      <div className="space-y-4">
        <p className="text-sm font-medium">{t("contact.social_heading")}</p>
        <p className="text-muted-foreground text-xs">
          {t("contact.social_help")}
        </p>
        <div className="grid gap-2">
          <Label>{t("contact.instagram_label")}</Label>
          <Input
            type="url"
            dir="ltr"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/sfashion"
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("contact.tiktok_label")}</Label>
          <Input
            type="url"
            dir="ltr"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="https://tiktok.com/@sfashion"
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("contact.snapchat_label")}</Label>
          <Input
            type="url"
            dir="ltr"
            value={snapchat}
            onChange={(e) => setSnapchat(e.target.value)}
            placeholder="https://snapchat.com/add/sfashion"
          />
        </div>
      </div>
    </form>
  )
}
