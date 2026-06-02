"use client"

/**
 * Localized 404 for anything under /{locale}. Rendered within the locale's
 * NextIntl provider, so it can translate. (The invalid-locale case bubbles to
 * the root `app/not-found.tsx` fallback instead.)
 */
import { useTranslations } from "next-intl"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

export default function LocaleNotFound() {
  const t = useTranslations("errors")

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-muted-foreground font-heading text-5xl">404</p>
      <h1 className="font-heading mt-3 text-3xl">{t("not_found_title")}</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        {t("not_found_description")}
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/">{t("back_to_shop")}</Link>
        </Button>
      </div>
    </div>
  )
}
