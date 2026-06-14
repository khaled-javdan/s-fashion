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
          <div className="group relative">
            <span className="flex cursor-default items-center gap-1 text-xs font-semibold tracking-widest text-foreground/80 uppercase select-none">
              {t("shop_all")}
            </span>
            <div className="invisible absolute start-1/2 top-full z-50 -translate-x-1/2 pt-3 group-hover:visible rtl:translate-x-1/2">
              <div className="flex min-w-40 flex-col overflow-hidden rounded-md border border-border bg-background py-1 shadow-md">
                <Link
                  href={`/${locale}/products`}
                  className="px-4 py-2.5 text-xs font-semibold tracking-widest text-foreground/70 uppercase transition hover:bg-muted hover:text-foreground"
                >
                  {t("shop_products")}
                </Link>
                <Link
                  href={`/${locale}/products?view=styles`}
                  className="px-4 py-2.5 text-xs font-semibold tracking-widest text-foreground/70 uppercase transition hover:bg-muted hover:text-foreground"
                >
                  {t("shop_styles")}
                </Link>
              </div>
            </div>
          </div>
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
