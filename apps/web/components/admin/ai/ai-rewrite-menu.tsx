"use client"

import { ChevronDown, Loader2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { rewriteAction } from "@/app/[locale]/admin/(authed)/ai/actions"
import { REWRITE_TONES, type RewriteTone } from "@/components/admin/ai/types"

type Props = {
  currentValue: string
  locale: "ar" | "en"
  /** What kind of text is being rewritten. */
  context: string
  /** Available tones — sensible default if omitted. */
  tones?: ReadonlyArray<RewriteTone>
  /** Called with the rewritten text. */
  onResult: (rewritten: string) => void
  /** Optional className for layout. */
  className?: string
}

/**
 * `✨ ▾` dropdown that rewrites `currentValue` in the chosen tone and hands the
 * result to `onResult`. Disabled while the text is empty; shows a spinner on
 * the active tone during the call.
 */
export function AiRewriteMenu({
  currentValue,
  locale,
  context,
  tones = REWRITE_TONES,
  onResult,
  className,
}: Props) {
  const t = useTranslations("admin.ai")
  const [pending, startTransition] = useTransition()
  const [activeTone, setActiveTone] = useState<RewriteTone | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isEmpty = currentValue.trim().length === 0

  const run = (tone: RewriteTone) => {
    setError(null)
    setActiveTone(tone)
    startTransition(async () => {
      const result = await rewriteAction({
        text: currentValue,
        locale,
        tone,
        context,
      })
      if (result.ok) {
        onResult(result.rewritten)
      } else {
        setError(result.error)
        setTimeout(() => setError(null), 4000)
      }
      setActiveTone(null)
    })
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isEmpty || pending}
            title={t("rewrite.trigger")}
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Sparkles aria-hidden />
            )}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("rewrite.heading")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tones.map((tone) => {
            const isActive = pending && activeTone === tone
            return (
              <DropdownMenuItem
                key={tone}
                disabled={pending}
                onSelect={(e) => {
                  e.preventDefault()
                  run(tone)
                }}
              >
                {isActive ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                <span>{t(`rewrite.tone.${tone}`)}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <span className="text-destructive text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  )
}
