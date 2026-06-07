"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { cn } from "@workspace/ui/lib/utils"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"

import { ModelSelect } from "./model-select"
import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL_ID } from "./types"

type Props = {
  /** The currently-configured model id (read server-side on the page). */
  initial: string
  /**
   * Notifies the parent of the active model so the analyze panel can name it in
   * its "model busy" message and stay in sync after a switch.
   */
  onModelChange?: (modelId: string) => void
  className?: string
}

/**
 * Compact, auto-saving model picker placed next to the analyze panel on the
 * product page. Removes the friction of going to Settings → AI when a model is
 * busy: changing the select persists `ai.model` immediately (no Save button) via
 * the same {@link updateSettingsAction} the settings form uses, then the next
 * Analyze/Regenerate picks it up server-side. Reverts on save failure.
 */
export function AiModelSwitcher({ initial, onModelChange, className }: Props) {
  const t = useTranslations("admin.ai")
  const ts = useTranslations("admin.settings")
  const normalized = AI_MODEL_OPTIONS.some((o) => o.id === initial)
    ? initial
    : DEFAULT_AI_MODEL_ID
  const [model, setModel] = useState(normalized)
  const [pending, startTransition] = useTransition()

  const change = (next: string) => {
    if (next === model) return
    const prev = model
    setModel(next)
    onModelChange?.(next)
    startTransition(async () => {
      const res = await updateSettingsAction({ key: "ai.model", value: next })
      if (res.ok) {
        toast.success(ts("ai_model.saved_toast"))
      } else {
        // Roll back the optimistic switch so the UI matches what's persisted.
        setModel(prev)
        onModelChange?.(prev)
        toast.error(res.error)
      }
    })
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-3" aria-hidden />
        )}
        {t("model.label")}
      </span>
      <ModelSelect
        value={model}
        onChange={change}
        disabled={pending}
        triggerClassName="h-8 w-auto min-w-[12rem]"
        showNote={false}
      />
    </div>
  )
}
