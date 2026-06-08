"use client"

import { Home, LayoutGrid, MoreHorizontal, ShoppingBag } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { cn } from "@workspace/ui/lib/utils"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

import { CartDrawer } from "@/components/cart/cart-drawer"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { ShipToSwitcher } from "@/components/layout/ship-to-switcher"
import {
  selectHasHydrated,
  selectItemCount,
  useCartStore,
} from "@/lib/cart-store"
import type { Locale } from "@/lib/locale"

export function BottomNav() {
  const t = useTranslations("header")
  const locale = useLocale() as Locale
  const pathname = usePathname()

  const [cartOpen, setCartOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const itemCount = useCartStore(selectItemCount)
  const hasHydrated = useCartStore(selectHasHydrated)
  const showBadge = hasHydrated && itemCount > 0

  const root = `/${locale}`

  const isActive = (href: string) =>
    href === root ? pathname === root : pathname.startsWith(href)

  // Shared tab wrapper — column layout, label below the pill.
  const tabClass = "flex flex-col items-center gap-1 py-2 px-2"
  const labelClass = (active: boolean) =>
    cn("text-[11px] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")
  // Google-style pill behind the icon only.
  const pillClass = (active: boolean) =>
    cn(
      "flex items-center justify-center rounded-full px-5 py-1 transition-colors",
      active ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
    )

  const moreLinks = [
    { key: "track", href: `${root}/orders/track` },
    { key: "shipping", href: `${root}/shipping` },
    { key: "returns", href: `${root}/returns` },
    { key: "contact", href: `${root}/contact` },
    { key: "about", href: `${root}/about` },
  ] as const

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden">
        <div className="flex h-16 items-center justify-around">
          {/* Home */}
          <Link href={root} className={tabClass}>
            <span className={pillClass(isActive(root))}>
              <Home className="size-5" />
            </span>
            <span className={labelClass(isActive(root))}>{t("nav_home")}</span>
          </Link>

          {/* Shop */}
          <Link href={`${root}/products`} className={tabClass}>
            <span className={pillClass(isActive(`${root}/products`))}>
              <LayoutGrid className="size-5" />
            </span>
            <span className={labelClass(isActive(`${root}/products`))}>{t("nav_shop")}</span>
          </Link>

          {/* Cart */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`${t("cart")} (${hasHydrated ? itemCount : 0})`}
            className={tabClass}
          >
            <span className={pillClass(false)}>
              <span className="relative">
                <ShoppingBag className="size-5" />
                {showBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                  >
                    {itemCount}
                  </span>
                )}
              </span>
            </span>
            <span className={labelClass(false)}>{t("cart")}</span>
          </button>

          {/* More */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={tabClass}
          >
            <span className={pillClass(moreOpen)}>
              <MoreHorizontal className="size-5" />
            </span>
            <span className={labelClass(moreOpen)}>{t("nav_more")}</span>
          </button>
        </div>
      </nav>

      {/* Cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <CartDrawer onClose={() => setCartOpen(false)} />
      </Sheet>

      {/* More sheet — slides up from bottom */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] gap-0 p-0">
          <SheetHeader className="border-b border-border p-5 text-start">
            <SheetTitle className="font-heading text-base tracking-[0.3em] uppercase">
              {t("brand")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("menu_description")}
            </SheetDescription>
          </SheetHeader>

          <nav className="flex flex-col p-2">
            {moreLinks.map((item) => (
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

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border p-4">
            <ShipToSwitcher />
            <LocaleSwitcher />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
