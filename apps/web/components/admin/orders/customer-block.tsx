"use client"

import { Check, Copy, MessageCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

type Props = {
  name: string
  phone: string
  email: string | null
  emirate: string
  city: string
  addressLine1: string
  addressLine2: string | null
  /** Prefilled WhatsApp message (already URL-decoded text). */
  whatsappText: string
}

function buildWaLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function CustomerBlock({
  name,
  phone,
  email,
  emirate,
  city,
  addressLine1,
  addressLine2,
  whatsappText,
}: Props) {
  const t = useTranslations("admin.orders")
  const [copied, setCopied] = useState(false)

  const addressLines = [
    addressLine1,
    addressLine2,
    `${city}, ${emirate}`,
  ].filter(Boolean) as string[]

  async function copyAddress() {
    const text = [name, phone, ...addressLines].join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  }

  return (
    <div className="bg-card text-card-foreground space-y-4 rounded-md border p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("customer.heading")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copyAddress}
          aria-label={t("customer.copy_address")}
        >
          {copied ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? t("customer.copied") : t("customer.copy")}
        </Button>
      </div>

      <div className="space-y-1">
        <div className="text-base font-medium">{name}</div>
        <a
          href={buildWaLink(phone, whatsappText)}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="text-primary inline-flex items-center gap-1.5 font-mono text-sm underline-offset-4 hover:underline"
        >
          <MessageCircle className="size-3.5" />
          {phone}
        </a>
        {email ? (
          <div className="text-muted-foreground text-sm" dir="ltr">
            {email}
          </div>
        ) : null}
      </div>

      <address className="text-sm not-italic leading-relaxed">
        {addressLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </address>
    </div>
  )
}
