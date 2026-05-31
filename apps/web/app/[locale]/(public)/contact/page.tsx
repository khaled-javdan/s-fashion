import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Clock, Mail, MessageCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { ContentPage, ContentSection } from "@/components/content/content-page"
import { LOCALES, type Locale } from "@/lib/locale"
import { getSetting } from "@/lib/repos/settings.repo"

/** Fallback mirrors the placeholder used by the floating WhatsApp button. */
const DEFAULT_WHATSAPP_NUMBER = "+971501234567"
/** Fallback used when no `contact.email` setting has been configured. */
const DEFAULT_CONTACT_EMAIL = "hello@sfashion.ae"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "contact" })
  return { title: t("title") }
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  if (!hasLocale(LOCALES, rawLocale)) notFound()
  const locale = rawLocale as Locale
  setRequestLocale(locale)

  const t = await getTranslations("contact")
  const tWhatsapp = await getTranslations("whatsapp")

  const [whatsappNumber, hoursAr, hoursEn, email] = await Promise.all([
    getSetting("contact.whatsapp_number"),
    getSetting("contact.business_hours_ar"),
    getSetting("contact.business_hours_en"),
    getSetting("contact.email"),
  ])

  const number = whatsappNumber ?? DEFAULT_WHATSAPP_NUMBER
  const contactEmail =
    email && email.trim() !== "" ? email.trim() : DEFAULT_CONTACT_EMAIL
  const digits = number.replace(/[^0-9]/g, "")
  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(
    tWhatsapp("prefill_message"),
  )}`

  const settingHours = locale === "ar" ? hoursAr : hoursEn
  // Fall back to the footer's hardcoded hours when settings aren't populated.
  const businessHours = settingHours ?? t("hours_fallback")

  return (
    <ContentPage title={t("title")} intro={t("intro")}>
      <ContentSection heading={t("whatsapp_heading")}>
        <p>{t("whatsapp_desc")}</p>
        <Button asChild className="mt-1 w-full sm:w-auto">
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" aria-hidden />
            {t("whatsapp_cta")}
          </a>
        </Button>
      </ContentSection>

      <ContentSection heading={t("email_heading")}>
        <p>{t("email_desc")}</p>
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Mail className="size-4 text-primary" aria-hidden />
          <a href={`mailto:${contactEmail}`} className="hover:underline">
            {contactEmail}
          </a>
        </p>
      </ContentSection>

      <ContentSection heading={t("hours_heading")}>
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Clock className="size-4 text-primary" aria-hidden />
          {businessHours}
        </p>
        <p>{t("hours_note")}</p>
      </ContentSection>
    </ContentPage>
  )
}
