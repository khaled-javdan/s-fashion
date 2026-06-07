"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@workspace/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { AI_MODEL_OPTIONS } from "./types"

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Override the trigger width/height (the inline switcher wants it compact). */
  triggerClassName?: string
  /** Show the selected model's `note` line beneath the select. */
  showNote?: boolean
}

/**
 * Presentational model picker over the curated {@link AI_MODEL_OPTIONS}
 * allow-list, with the free/paid tier badge. Shared by the Settings → AI form
 * and the inline switcher on the product page so the option list, badges, and
 * labels stay in one place. Controlled — the parent owns the value + save path.
 */
export function ModelSelect({
  value,
  onChange,
  disabled,
  triggerClassName,
  showNote = true,
}: Props) {
  const t = useTranslations("admin.settings")
  const selected = AI_MODEL_OPTIONS.find((o) => o.id === value)

  return (
    <div className="grid gap-2">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName ?? "w-full sm:max-w-md"}>
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
      {showNote && selected?.note ? (
        <p className="text-muted-foreground text-xs">{selected.note}</p>
      ) : null}
    </div>
  )
}
