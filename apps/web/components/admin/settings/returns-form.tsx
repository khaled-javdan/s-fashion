"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"

type Props = {
  windowDays: number
}

export function ReturnsForm({ windowDays }: Props) {
  const t = useTranslations("admin.settings")
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState(String(windowDays))
  const [days, setDays] = useState(saved)
  const [pending, startTransition] = useTransition()

  const dirty = days !== saved

  const save = () => {
    const daysNum = Math.floor(Number(days))
    if (!Number.isFinite(daysNum) || daysNum < 0 || daysNum > 90) {
      toast.error(t("returns.invalid"))
      return
    }

    const snapshot = String(daysNum)
    startTransition(async () => {
      const res = await updateSettingsAction({
        key: "returns.window_days",
        value: daysNum,
      })
      if (res.ok) {
        setSaved(snapshot)
        setDays(snapshot)
        toast.success(t("returns.saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  const discard = () => setDays(saved)

  useSaveBar("settings-returns", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2 sm:max-w-xs">
        <Label>{t("returns.window_days_label")}</Label>
        <Input
          type="number"
          min={0}
          max={90}
          step="1"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {t("returns.window_days_help")}
        </p>
      </div>
    </form>
  )
}
