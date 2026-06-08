"use client"

import { Menu } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import { ShipToSwitcher } from "@/components/layout/ship-to-switcher"
import type { Locale } from "@/lib/locale"

/**
 * Mobile navigation drawer (the storefront counterpart to the admin sidebar).
 *
 * A hamburger button opens a clean off-canvas Sheet listing every important
 * customer page, plus the ship-to and language switchers — controls that are
 * otherwise desktop-only in the header. Hidden at `md` and up, where the inline
 * top nav takes over. The drawer slides in from the reader's start edge (left
 * in LTR, right in RTL).
 */
export function MobileMenu() {
  const t = useTranslations("header")
  const locale = useLocale() as Locale
  const [open, setOpen] = useState(false)

  const root = `/${locale}`
  const links = [
    { key: "shop_all", href: `${root}/products` },
    { key: "track", href: `${root}/orders/track` },
    { key: "shipping", href: `${root}/shipping` },
    { key: "returns", href: `${root}/returns` },
    { key: "contact", href: `${root}/contact` },
    { key: "about", href: `${root}/about` },
  ] as const

  const side = locale === "ar" ? "right" : "left"

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("open_menu")}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side={side} className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-border p-5 text-start">
          <SheetTitle asChild>
            <Link
              href={root}
              onClick={() => setOpen(false)}
              className="font-heading text-lg tracking-[0.3em] uppercase text-foreground"
            >
              {t("brand")}
            </Link>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("menu_description")}
          </SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col p-2">
          {links.map((item) => (
            <SheetClose asChild key={item.key}>
              <Link
                href={item.href}
                className="rounded-md px-3 py-3 text-sm font-semibold uppercase tracking-widest text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                {t(item.key)}
              </Link>
            </SheetClose>
          ))}
        </nav>

        {/* Pinned to the bottom: country/currency switcher. Language is now
            always visible in the mobile header. */}
        <div className="mt-auto border-t border-border p-3">
          <ShipToSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  )
}
