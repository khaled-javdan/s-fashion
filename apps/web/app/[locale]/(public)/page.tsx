import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, PackageSearch } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { AdminEditBar } from "@/components/admin-bar/admin-edit-bar"
import { BestSellers } from "@/components/home/best-sellers"
import { Hero } from "@/components/home/hero"
import { ProductGrid } from "@/components/home/product-grid"
import { ShopBy } from "@/components/home/shop-by"
import { Testimonials } from "@/components/home/testimonials"
import { UgcStrip } from "@/components/home/ugc-strip"
import { ValueProps } from "@/components/home/value-props"
import { WhatsappSignup } from "@/components/home/whatsapp-signup"
import { WhatsappPopup } from "@/components/marketing/whatsapp-popup"
import { ProductCard } from "@/components/product/product-card"
import { RecentlyViewed } from "@/components/product/recently-viewed"
import { parseGridConfig } from "@/lib/grid-config"
import { LOCALES, type Locale } from "@/lib/locale"
import { listActiveProducts } from "@/lib/repos/products.repo"
import { getRatingSummaries } from "@/lib/repos/reviews.repo"
import { getSetting } from "@/lib/repos/settings.repo"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "home" })
  return { title: t("title") }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)

  const typedLocale: Locale = locale
  const t = await getTranslations("home")
  const tTrack = await getTranslations("tracking")
  const tProduct = await getTranslations("product")
  const [products, gridRaw] = await Promise.all([
    listActiveProducts({ take: 60 }),
    getSetting("home.grid"),
  ])
  const grid = parseGridConfig(gridRaw)
  const ratings = await getRatingSummaries(products.map((p) => p.id))

  return (
    <>
      <AdminEditBar
        dashboardHref={`/${typedLocale}/admin`}
        editHref={`/${typedLocale}/admin/settings`}
        editLabel="Edit hero"
      />
      <Hero products={products} locale={typedLocale} />
      <ValueProps locale={typedLocale} />
      <ShopBy locale={typedLocale} />

      <section className="border-y border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-start lg:px-0">
          <div className="flex items-center gap-3">
            <PackageSearch
              className="size-6 shrink-0 text-primary"
              aria-hidden
            />
            <div>
              <p className="font-heading text-lg tracking-wide text-foreground">
                {tTrack("home_heading")}
              </p>
              <p className="text-sm text-muted-foreground">
                {tTrack("home_subheading")}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href={`/${typedLocale}/orders/track`}>
              {tTrack("home_cta")}
            </Link>
          </Button>
        </div>
      </section>

      <BestSellers locale={typedLocale} />

      <Testimonials locale={typedLocale} />
      <UgcStrip locale={typedLocale} />
      <WhatsappSignup locale={typedLocale} />

      <section
        id="shop"
        className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-0"
      >
        <div className="mb-8 flex flex-col gap-1">
          <h2 className="font-heading text-2xl tracking-wide sm:text-3xl">
            {t("shop_heading")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("shop_subheading")}
          </p>
        </div>
        {products.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center">
            {t("empty")}
          </p>
        ) : (
          <>
            <ProductGrid config={grid} storageScope="home">
              {products.map((product, index) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    locale={typedLocale}
                    priority={index < 4}
                    rating={ratings.get(product.id)}
                  />
                </li>
              ))}
            </ProductGrid>
            <div className="mt-10 flex justify-center sm:mt-12">
              <Button asChild variant="outline" size="lg">
                <Link href={`/${typedLocale}/products`}>
                  {t("view_all")}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
            </div>
          </>
        )}

        <RecentlyViewed
          locale={typedLocale}
          title={tProduct("recently_viewed")}
        />
      </section>

      <WhatsappPopup />
    </>
  )
}
