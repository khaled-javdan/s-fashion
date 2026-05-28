import { hasLocale, NextIntlClientProvider } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { LOCALES, localeDirection, type Locale } from "@/lib/locale"

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

/**
 * Locale-aware root for everything under /{locale}/*. Only sets up the
 * NextIntl provider and the dir wrapper — public-vs-admin shell lives in
 * the nested route groups (`(public)`, `admin/`).
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!hasLocale(LOCALES, locale)) {
    notFound()
  }

  setRequestLocale(locale)

  const typedLocale: Locale = locale
  const dir = localeDirection(typedLocale)

  return (
    <NextIntlClientProvider>
      <div lang={typedLocale} dir={dir} data-locale={typedLocale}>
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
