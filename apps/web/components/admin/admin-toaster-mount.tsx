"use client"

import { useLocale } from "next-intl"

import { Toaster } from "@workspace/ui/components/sonner"

import type { Locale } from "@/lib/locale"

/**
 * Single sonner `<Toaster />` mount for the admin surface.
 *
 * Mounted once in the authed admin layout so any admin client component (forms,
 * the save bar, AI panels) can fire `toast(...)` and have it surface. Direction
 * follows the active locale so toasts read naturally in both LTR and RTL.
 */
export function AdminToasterMount() {
  const locale = useLocale() as Locale

  return (
    <Toaster
      position="bottom-right"
      dir={locale === "ar" ? "rtl" : "ltr"}
      richColors
      closeButton
    />
  )
}
