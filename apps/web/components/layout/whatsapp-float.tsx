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
 * Client component — the phone number is resolved server-side from the
 * `contact.whatsapp_number` setting and passed in as a prop.
 */
const FALLBACK_WHATSAPP_NUMBER = "+971501234567"

export function WhatsappFloat({ phoneNumber }: { phoneNumber?: string }) {
  const pathname = usePathname()
  const t = useTranslations("whatsapp")

  if (pathname?.startsWith("/admin")) return null

  const isProductPage = /\/products\/[^/]+/.test(pathname ?? "")

  const digits = (phoneNumber || FALLBACK_WHATSAPP_NUMBER).replace(
    /[^0-9]/g,
    "",
  )
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(
    t("prefill_message"),
  )}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("open_label")}
      className={`fixed end-4 z-50 inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-foreground/10 ring-1 ring-black/5 transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isProductPage ? "bottom-[141px] md:bottom-[76px]" : "bottom-[76px]"}`}
    >
      <MessageCircle className="size-6" aria-hidden="true" />
      <span className="sr-only">{t("open_label")}</span>
    </a>
  )
}
