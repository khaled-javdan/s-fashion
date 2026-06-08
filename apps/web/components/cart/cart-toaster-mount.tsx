"use client"

import { useLocale } from "next-intl"

import { Toaster } from "@workspace/ui/components/sonner"

import type { Locale } from "@/lib/locale"

/**
 * Single sonner `<Toaster />` mount for the public surface.
 *
 * Mounted once at the bottom of `(public)/layout.tsx`. Any client component
 * (e.g. Track E's add-to-cart button) can fire `toast(...)` and it surfaces
 * here. Positioned at the inline-end / bottom so it reads naturally in both
 * LTR and RTL — sonner's `dir` is driven by the active locale.
 */
export function CartToasterMount() {
  const locale = useLocale() as Locale

  return (
    <Toaster
      position="bottom-center"
      dir={locale === "ar" ? "rtl" : "ltr"}
      closeButton
    />
  )
}
