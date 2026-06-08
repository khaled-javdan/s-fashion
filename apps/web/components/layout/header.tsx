import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { CartButton } from "@/components/layout/cart-button"
import { MobileSearch } from "@/components/layout/mobile-search"
import { SearchBox } from "@/components/layout/search-box"
import { ShipToSwitcher } from "@/components/layout/ship-to-switcher"
import type { Locale } from "@/lib/locale"

/**
 * Public header.
 *
 * - Mobile (<md): brand centered · search icon end.
 * - Desktop (≥md): brand · nav · search + ship-to + locale + cart.
 */
export function Header() {
  const t = useTranslations("header")
  const locale = useLocale() as Locale

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4 sm:h-16 sm:px-6 lg:px-0">
        {/* Mobile: brand centered, search icon pinned to the end. */}
        <div className="flex flex-1 items-center justify-center md:hidden">
          <BrandWordmark locale={locale} />
        </div>
        <div className="absolute end-4 md:hidden">
          <MobileSearch />
        </div>

        {/* Desktop: brand start. */}
        <div className="hidden md:flex md:flex-1 md:justify-start">
          <BrandWordmark locale={locale} />
        </div>

        {/* Desktop: centered nav. */}
        <nav className="hidden md:flex md:flex-1 md:items-center md:justify-center md:gap-8">
          <Link
            href={`/${locale}/products`}
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

        {/* Desktop: search + ship-to + locale + cart end. */}
        <div className="hidden md:flex md:flex-1 md:items-center md:justify-end md:gap-2">
          <div className="w-48 lg:w-64">
            <SearchBox />
          </div>
          <ShipToSwitcher />
          <LocaleSwitcher />
          <CartButton label={t("cart")} locale={locale} />
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
      SFASHION
    </Link>
  )
}
