"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { MessageCircle } from "lucide-react"

/**
 * Floating WhatsApp button.
 *
 * Pinned to the inline-end / bottom corner so it flips automatically between
 * Arabic (RTL → bottom-left) and English (LTR → bottom-right) via the
 * `end-4` logical class.
 *
 * Hidden on `/admin/*` (admin operators don't need a customer-facing
 * WhatsApp deeplink).
 *
 * The phone number is hardcoded in Round 1; Track B's settings repo
 * (`contact.whatsapp_number`) will replace this in Round 2.
 */
const WHATSAPP_NUMBER = "+971501234567" // placeholder — TODO: read from Setting in Round 2
const WHATSAPP_NUMBER_DIGITS = WHATSAPP_NUMBER.replace(/[^0-9]/g, "")

export function WhatsappFloat() {
  const pathname = usePathname()
  const t = useTranslations("whatsapp")

  if (pathname?.startsWith("/admin")) return null

  const url = `https://wa.me/${WHATSAPP_NUMBER_DIGITS}?text=${encodeURIComponent(
    t("prefill_message"),
  )}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("open_label")}
      className="fixed bottom-[76px] end-4 z-50 inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-foreground/10 ring-1 ring-black/5 transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
      <span className="sr-only">{t("open_label")}</span>
    </a>
  )
}
