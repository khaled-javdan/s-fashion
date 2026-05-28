import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { LOCALES } from "@/lib/locale"

/**
 * PDP stub (Round 1).
 *
 * Track A owns this file only as a placeholder so the route exists for QA
 * (the DoD checklist hits `/[locale]/products/test-slug`). The real PDP —
 * gallery, variants, size chart, add-to-cart — is owned by Track E.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params

  if (!hasLocale(LOCALES, locale)) notFound()

  setRequestLocale(locale)

  const t = await getTranslations("product")

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16">
      <h1 className="font-heading text-3xl tracking-wide text-foreground">
        {t("stub_heading")}
      </h1>
      <p className="text-sm text-muted-foreground">
        <span className="me-2 font-semibold uppercase tracking-wider">
          {t("stub_slug_label")}:
        </span>
        <code className="rounded-sm bg-muted px-2 py-0.5 font-mono text-sm">
          {slug}
        </code>
      </p>
    </section>
  )
}
