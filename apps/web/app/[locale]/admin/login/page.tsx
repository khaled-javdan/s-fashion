import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

import { LoginForm } from "./login-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations({ locale, namespace: "admin.login" })
  return { title: t("page_title") }
}

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE

  const session = await auth()
  if (session?.user) {
    redirect(`/${locale}/admin`)
  }

  const t = await getTranslations({ locale, namespace: "admin" })

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-heading text-2xl uppercase tracking-[0.2em]">
            {t("brand")}
          </h1>
          <p className="text-muted-foreground mt-2 text-xs font-medium uppercase tracking-widest">
            {t("login.title")}
          </p>
        </div>
        <LoginForm locale={locale} />
      </div>
    </div>
  )
}
