"use client"

import { Languages, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { translateAction } from "@/app/[locale]/admin/(authed)/ai/actions"

type Props = {
  /** Current English value of the pair. */
  valueEn: string
  /** Current Arabic value of the pair. */
  valueAr: string
  /** Hint for the system prompt — what surface this is on. */
  context: string
  /** Called with the language that was filled in and its translated text. */
  onResult: (lang: "en" | "ar", text: string) => void
  /** Render just the icon (no "EN → AR" label) — for tight rows. */
  iconOnly?: boolean
  className?: string
}

/**
 * A single, bidirectional translate button for a bilingual field pair.
 *
 * It auto-detects direction: whichever language has text is translated into
 * the other. If only the English side is filled it writes Arabic, and vice
 * versa; when both are filled it translates English → Arabic. Disabled only
 * when both are empty. This replaces scattering per-direction AI buttons —
 * one button per pair handles both ways.
 */
export function AiTranslatePairButton({
  valueEn,
  valueAr,
  context,
  onResult,
  iconOnly = false,
  className,
}: Props) {
  const t = useTranslations("admin.ai")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const enFilled = valueEn.trim().length > 0
  const arFilled = valueAr.trim().length > 0
  // Direction: filled → empty; both filled defaults to EN → AR.
  const from: "en" | "ar" = enFilled ? "en" : "ar"
  const to: "en" | "ar" = from === "en" ? "ar" : "en"
  const disabled = pending || (!enFilled && !arFilled)

  const onClick = () => {
    setError(null)
    const source = from === "en" ? valueEn : valueAr
    startTransition(async () => {
      const result = await translateAction({ text: source, from, to, context })
      if (result.ok) {
        onResult(to, result.translated)
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
        size={iconOnly ? "icon-xs" : "xs"}
        onClick={onClick}
        disabled={disabled}
        aria-label={t("translate.pair_label", {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
        })}
        title={
          disabled && !pending
            ? t("translate.empty_hint")
            : t("translate.pair_label", {
                from: from.toUpperCase(),
                to: to.toUpperCase(),
              })
        }
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Languages aria-hidden />
        )}
        {iconOnly ? null : `${from.toUpperCase()} → ${to.toUpperCase()}`}
      </Button>
      {error ? (
        <span className="text-destructive text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  )
}
