import { getTranslations } from "next-intl/server"
import { MessageCircle } from "lucide-react"

import { WhatsappCapture } from "@/components/marketing/whatsapp-capture"
import type { Locale } from "@/lib/locale"

/**
 * Inline home-page marketing section: a headline + subcopy alongside the
 * WhatsApp first-order capture form. Server component (static copy); the form
 * itself is the client {@link WhatsappCapture}.
 */
export async function WhatsappSignup({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketing" })

  return (
    <section
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="border-y border-border bg-card"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-0">
        <div className="space-y-3 text-center lg:text-start">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("badge")}
          </span>
          <h2 className="font-heading text-2xl tracking-wide text-foreground sm:text-3xl">
            {t("headline")}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t("subcopy")}
          </p>
        </div>
        <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-background p-6">
          <WhatsappCapture />
        </div>
      </div>
    </section>
  )
}
