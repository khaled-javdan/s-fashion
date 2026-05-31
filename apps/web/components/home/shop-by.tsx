import { getTranslations } from "next-intl/server"
import Image from "next/image"
import Link from "next/link"

import type { Locale } from "@/lib/locale"
import { getSetting } from "@/lib/repos/settings.repo"
import { parseShopByConfig, resolveShopByHref } from "@/lib/shop-by-config"

/**
 * Home "Shop by" tiles.
 *
 * Server Component. Reads the admin-configured `home.shop_by` setting and
 * renders a responsive grid of image tiles, each deep-linking into the
 * `/products` listing with pre-applied filters. Renders nothing when the
 * feature is disabled or no tiles are configured, so the home page never shows
 * an empty heading. RTL-aware via logical Tailwind utilities.
 */
export async function ShopBy({ locale }: { locale: Locale }) {
  const t = await getTranslations("home")
  const config = parseShopByConfig(await getSetting("home.shop_by"))

  if (!config.enabled || config.tiles.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <div className="mb-8 flex flex-col gap-1">
        <h2 className="font-heading text-2xl tracking-wide sm:text-3xl">
          {t("shop_by.heading")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("shop_by.subheading")}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {config.tiles.map((tile, index) => {
          const label = locale === "ar" ? tile.labelAr : tile.labelEn
          const href = resolveShopByHref(tile.href, locale)
          return (
            <li key={`${tile.href}-${index}`}>
              <Link
                href={href}
                className="group focus-visible:ring-ring relative block aspect-[3/4] overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Image
                  src={tile.imageUrl}
                  alt={label || ""}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  priority={index < 2}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
                />
                {label ? (
                  <span className="absolute inset-x-0 bottom-0 p-4 text-start font-heading text-lg tracking-wide text-white">
                    {label}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
