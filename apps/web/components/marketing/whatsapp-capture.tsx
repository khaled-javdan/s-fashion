"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { parsePhoneNumberFromString } from "libphonenumber-js"
import { Check, Copy, Loader2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { subscribeWhatsappAction } from "@/app/[locale]/(public)/marketing-actions"
import { PhoneField } from "@/components/forms/phone-field"
import { COUNTRY_CODES, DEFAULT_COUNTRY } from "@/lib/geo"
import type { Locale } from "@/lib/locale"

/**
 * WhatsApp first-order capture form. Collects name + phone, records marketing
 * consent (server action), and on success reveals a single-use welcome coupon
 * with copy-to-clipboard. Reused by the inline home section + the popup.
 *
 * `onSubscribed` lets a wrapper (e.g. the popup) remember the success so it
 * never re-prompts.
 */
export function WhatsappCapture({
  onSubscribed,
  compact = false,
}: {
  onSubscribed?: () => void
  compact?: boolean
}) {
  const t = useTranslations("marketing")
  const locale = useLocale() as Locale

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function canonicalPhone(): string | null {
    const parsed = parsePhoneNumberFromString(phone.trim())
    return parsed && parsed.isValid() ? parsed.number : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 1) {
      setError(t("error.name_required"))
      return
    }
    const e164 = canonicalPhone()
    if (!e164) {
      setError(t("error.invalid_phone"))
      return
    }

    setSubmitting(true)
    try {
      const result = await subscribeWhatsappAction({
        name: name.trim(),
        phone: e164,
        locale,
      })
      if (result.ok) {
        setCode(result.code)
        onSubscribed?.()
      } else {
        setError(
          result.error === "invalid_request"
            ? t("error.invalid_request")
            : t("error.generic"),
        )
      }
    } catch {
      setError(t("error.generic"))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — the code is still visible to copy by hand.
    }
  }

  if (code) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-medium text-foreground">{t("success_title")}</p>
        <p className="text-sm text-muted-foreground">{t("success_body")}</p>
        <div className="flex items-center justify-center gap-2">
          <code
            dir="ltr"
            className="rounded-md border border-dashed border-border bg-muted px-4 py-2 font-mono text-lg font-semibold uppercase tracking-wider"
          >
            {code}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label={t("copy_code")}
          >
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="wa-name" className={compact ? "sr-only" : undefined}>
          {t("name_label")}
        </Label>
        <Input
          id="wa-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder={t("name_placeholder")}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="wa-phone" className={compact ? "sr-only" : undefined}>
          {t("phone_label")}
        </Label>
        <PhoneField
          id="wa-phone"
          value={phone}
          onChange={setPhone}
          defaultCountry={DEFAULT_COUNTRY}
          countries={[...COUNTRY_CODES]}
          locale={locale}
          placeholder={t("phone_placeholder")}
          invalid={!!error}
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm font-medium">{error}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        {t("consent")}
      </p>
    </form>
  )
}
