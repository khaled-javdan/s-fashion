"use client"

import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL_ID } from "@/components/admin/ai/types"

type Props = {
  /** Currently configured model id (defaults applied upstream). */
  current: string
}

/**
 * Picks the Gateway model powering the admin AI copilot (image analyze,
 * translate, rewrite). Choices are the curated AI_MODEL_OPTIONS allow-list —
 * the same list the server validates against, so an arbitrary model string
 * can never be saved.
 */
export function AiModelForm({ current }: Props) {
  const t = useTranslations("admin.settings")
  const initial = AI_MODEL_OPTIONS.some((o) => o.id === current)
    ? current
    : DEFAULT_AI_MODEL_ID
  const [model, setModel] = useState(initial)
  const [pending, startTransition] = useTransition()

  const selected = AI_MODEL_OPTIONS.find((o) => o.id === model)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateSettingsAction({ key: "ai.model", value: model })
      if (result.ok) {
        toast.success(t("ai_model.saved_toast"))
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>{t("ai_model.label")}</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-full sm:max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_MODEL_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="flex items-center gap-2">
                  <span>{o.label}</span>
                  <Badge
                    variant={o.tier === "free" ? "secondary" : "outline"}
                    className="normal-case tracking-normal"
                  >
                    {o.tier === "free"
                      ? t("ai_model.tier_free")
                      : t("ai_model.tier_paid")}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected?.note ? (
          <p className="text-muted-foreground text-xs">{selected.note}</p>
        ) : null}
      </div>

      {selected?.tier === "paid" ? (
        <p className="text-muted-foreground text-xs">
          {t("ai_model.paid_note")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t("ai_model.save_button")}
      </Button>
    </form>
  )
}
