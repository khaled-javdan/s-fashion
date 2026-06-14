"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"

type MarketMode = "uae" | "gcc"

export function MarketModeForm({ initial }: { initial: MarketMode }) {
  const t = useTranslations("admin.settings.market_mode")
  const [mode, setMode] = useState<MarketMode>(initial)
  const [pending, startTransition] = useTransition()

  const isGcc = mode === "gcc"

  const toggle = (checked: boolean) => {
    const next: MarketMode = checked ? "gcc" : "uae"
    startTransition(async () => {
      const res = await updateSettingsAction({ key: "market.mode", value: next })
      if (res.ok) {
        setMode(next)
        toast.success(t("saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex items-start gap-4">
      <Switch
        id="market-mode-switch"
        checked={isGcc}
        onCheckedChange={toggle}
        disabled={pending}
      />
      <div className="space-y-1">
        <Label htmlFor="market-mode-switch" className="text-sm font-medium">
          {isGcc ? t("gcc_label") : t("uae_label")}
        </Label>
        <p className="text-muted-foreground text-xs">
          {isGcc ? t("gcc_description") : t("uae_description")}
        </p>
      </div>
    </div>
  )
}
