"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { translateAction } from "@/app/[locale]/admin/(authed)/ai/actions"

type Props = {
  /** The source field's current value. */
  sourceValue: string
  /** Source language. */
  from: "ar" | "en"
  /** Target language. */
  to: "ar" | "en"
  /** Hint for the system prompt — what surface this is on. */
  context: string
  /** Called when translation succeeds. */
  onResult: (translated: string) => void
  /** Optional disabled override. */
  disabled?: boolean
  /** Optional className for layout. */
  className?: string
}

/**
 * `✨ EN → AR` button that translates `sourceValue` into the sibling language
 * and hands the result to `onResult`. Disabled while the source is empty or a
 * call is in flight. Errors surface inline and auto-clear after 4s.
 */
export function AiTranslateButton({
  sourceValue,
  from,
  to,
  context,
  onResult,
  disabled,
  className,
}: Props) {
  const t = useTranslations("admin.ai")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const label = `${from.toUpperCase()} → ${to.toUpperCase()}`
  const isDisabled = disabled || pending || sourceValue.trim().length === 0

  const onClick = () => {
    setError(null)
    startTransition(async () => {
      const result = await translateAction({
        text: sourceValue,
        from,
        to,
        context,
      })
      if (result.ok) {
        onResult(result.translated)
      } else {
        setError(result.error)
        setTimeout(() => setError(null), 4000)
      }
    })
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onClick}
        disabled={isDisabled}
        title={t("translate.title", {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
        })}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Sparkles aria-hidden />
        )}
        {label}
      </Button>
      {error ? (
        <span className="text-destructive text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  )
}
