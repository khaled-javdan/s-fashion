"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"

type Props = {
  contentAr: string
  contentEn: string
}

/**
 * Edits the bilingual `product.shipping_return` setting rendered in the PDP
 * tabs. Plain text; newlines are preserved client-side via whitespace-pre-line
 * when displayed.
 */
export function ShippingReturnForm({ contentAr, contentEn }: Props) {
  const t = useTranslations("admin.settings")
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState({ ar: contentAr, en: contentEn })
  const [ar, setAr] = useState(saved.ar)
  const [en, setEn] = useState(saved.en)
  const [pending, startTransition] = useTransition()

  const dirty = ar !== saved.ar || en !== saved.en

  const save = () => {
    const snapshot = { ar, en }
    startTransition(async () => {
      const result = await updateSettingsAction({
        key: "product.shipping_return",
        value: { contentAr: ar.trim(), contentEn: en.trim() },
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSaved(snapshot)
      toast.success(t("shipping_return.saved_toast"))
    })
  }

  const discard = () => {
    setAr(saved.ar)
    setEn(saved.en)
  }

  useSaveBar("settings-shipping-return", {
    dirty,
    saving: pending,
    save,
    discard,
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("shipping_return.content_en_label")}</Label>
          <Textarea
            rows={8}
            value={en}
            onChange={(e) => setEn(e.target.value)}
            placeholder={t("shipping_return.content_placeholder")}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("shipping_return.content_ar_label")}</Label>
          <Textarea
            rows={8}
            dir="rtl"
            value={ar}
            onChange={(e) => setAr(e.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {t("shipping_return.help")}
      </p>
    </form>
  )
}
