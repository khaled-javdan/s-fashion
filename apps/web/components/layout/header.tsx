import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { CartButton } from "@/components/layout/cart-button"
import { ShipToSwitcher } from "@/components/layout/ship-to-switcher"
import type { Locale } from "@/lib/locale"

/**
 * Public header.
 *
 * Layout:
 *  - Mobile (<768px): locale switcher (start) · centered brand · cart (end).
 *  - Desktop (>=768px): brand (start) · nav (center) · cart + locale (end).
 *
 * Server Component — the only interactive piece (cart count badge) is a
 * dedicated client leaf (`CartButton`) so this whole header can be cached
 * by Next.js.
 */
export function Header() {
  const t = useTranslations("header")
  const locale = useLocale() as Locale

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4 sm:h-16 sm:px-6 lg:px-0">
        {/* Mobile-only: locale switcher pinned to the start. */}
        <div className="flex flex-1 justify-start md:hidden">
          <LocaleSwitcher />
        </div>

        {/* Desktop-only: brand pinned to the start. */}
        <div className="hidden md:flex md:flex-1 md:justify-start">
          <BrandWordmark locale={locale} />
        </div>

        {/* Mobile-only: brand centered. */}
        <div className="flex flex-1 justify-center md:hidden">
          <BrandWordmark locale={locale} />
        </div>

        {/* Desktop-only: top nav. */}
        <nav className="hidden md:flex md:flex-1 md:items-center md:justify-center md:gap-8">
          <Link
            href={`/${locale}`}
            className="text-xs font-semibold tracking-widest text-foreground/80 uppercase hover:text-foreground"
          >
            {t("shop_all")}
          </Link>
          <Link
            href={`/${locale}/orders/track`}
            className="text-xs font-semibold tracking-widest text-foreground/80 uppercase hover:text-foreground"
          >
            {t("track")}
          </Link>
        </nav>

        {/* Cart + (desktop only) ship-to + locale switcher pinned to the end. */}
        <div className="flex flex-1 items-center justify-end gap-1 md:gap-2">
          <CartButton label={t("cart")} locale={locale} />
          <div className="hidden md:block">
            <ShipToSwitcher />
          </div>
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </header>
  )
}

function BrandWordmark({ locale }: { locale: Locale }) {
  return (
    <Link
      href={`/${locale}`}
      aria-label="SFashion"
      className="font-heading text-lg tracking-[0.35em] whitespace-nowrap text-foreground uppercase sm:text-xl"
    >
      <span className="sm:hidden">SFASHION</span>
      <span className="hidden sm:inline">SFASHION</span>
    </Link>
  )
}
