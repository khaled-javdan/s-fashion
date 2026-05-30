"use client"

import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

type Props = {
  /** Override the default "AI suggested — edit to override" text. */
  label?: string
  className?: string
}

/**
 * Tiny `✨ AI suggested` pill rendered next to a field that was populated by
 * an AI suggestion, until the admin edits it. Purely presentational.
 */
export function AiSuggestionBadge({ label, className }: Props) {
  const t = useTranslations("admin.ai")
  return (
    <Badge
      variant="secondary"
      className={cn("text-primary/80 normal-case tracking-normal", className)}
      title={t("suggestion.tooltip")}
    >
      <Sparkles aria-hidden />
      {label ?? t("suggestion.badge")}
    </Badge>
  )
}
