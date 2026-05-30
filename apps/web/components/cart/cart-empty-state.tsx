"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { ShoppingBag } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { Locale } from "@/lib/locale"

/**
 * Empty-cart placeholder, shared by the drawer and the full cart page.
 *
 * `onNavigate` lets the drawer close itself when the user taps "Continue
 * shopping" (the full page passes nothing).
 */
export function CartEmptyState({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("cart")
  const locale = useLocale() as Locale

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShoppingBag className="size-7" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-lg tracking-wide text-foreground">
          {t("empty")}
        </p>
        <p className="text-sm text-muted-foreground">{t("empty_hint")}</p>
      </div>
      <Button asChild>
        <Link href={`/${locale}`} onClick={onNavigate}>
          {t("continue_shopping")}
        </Link>
      </Button>
    </div>
  )
}
