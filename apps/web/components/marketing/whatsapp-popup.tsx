"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { WhatsappCapture } from "@/components/marketing/whatsapp-capture"
import type { Locale } from "@/lib/locale"

// localStorage key remembering that the visitor dismissed or subscribed — once
// set, the popup never re-shows. Mirrors the grid-density localStorage pattern.
const DISMISSED_KEY = "s-fashion-wa-popup-dismissed"
// Default reveal delay (ms). Shortened to ~0 when reduced motion is preferred so
// the animation never plays jarringly.
const SHOW_AFTER_MS = 8000

/**
 * Dismissible, timed WhatsApp capture modal. Shows once per visitor after a
 * short delay, never again after dismissal or a successful subscribe (remembered
 * in localStorage). Honors `prefers-reduced-motion` by skipping the entrance
 * delay. Wraps {@link WhatsappCapture}.
 */
export function WhatsappPopup() {
  const t = useTranslations("marketing")
  const locale = useLocale() as Locale
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Already handled this visitor — never re-prompt.
    try {
      if (window.localStorage.getItem(DISMISSED_KEY)) return
    } catch {
      return
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    const delay = reduceMotion ? 0 : SHOW_AFTER_MS

    const timer = window.setTimeout(() => {
      setOpen(true)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [])

  /** Persist that we've prompted this visitor so it never shows again. */
  function remember() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1")
    } catch {
      // best-effort
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) remember()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir={locale === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl tracking-wide">
            {t("popup_title")}
          </DialogTitle>
          <DialogDescription>{t("popup_subcopy")}</DialogDescription>
        </DialogHeader>
        <WhatsappCapture onSubscribed={remember} compact />
      </DialogContent>
    </Dialog>
  )
}
