import { Fragment } from "react"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PackageSearch } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { AdminEditBar } from "@/components/admin-bar/admin-edit-bar"
import { Hero } from "@/components/home/hero"
import { ProductRow } from "@/components/home/product-row"
import { ShopBy } from "@/components/home/shop-by"
import { Testimonials } from "@/components/home/testimonials"
import { UgcStrip } from "@/components/home/ugc-strip"
import { ValueProps } from "@/components/home/value-props"
import { WhatsappSignup } from "@/components/home/whatsapp-signup"
import { WhatsappPopup } from "@/components/marketing/whatsapp-popup"
import { RecentlyViewed } from "@/components/product/recently-viewed"
import { parseGridConfig } from "@/lib/grid-config"
import {
  parseHomeLayout,
  productBlockCtaHref,
  staticBlockLimit,
  type ProductBlock,
  type StaticBlock,
  type StaticSectionKey,
} from "@/lib/home-sections-config"
import { LOCALES, type Locale } from "@/lib/locale"
import {
  getProductsByIds,
  listActiveProducts,
  listProductsForSource,
} from "@/lib/repos/products.repo"
import { getRatingSummaries } from "@/lib/repos/reviews.repo"
import { getSetting } from "@/lib/repos/settings.repo"
import { resolveShopByHref } from "@/lib/shop-by-config"

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
  const [heroProducts, gridRaw, layoutRaw, whatsappEnabledRaw] = await Promise.all([
    listActiveProducts({ take: 60 }),
    getSetting("home.grid"),
    getSetting("home.sections"),
    getSetting("marketing.whatsapp_enabled"),
  ])
  const whatsappEnabled = (whatsappEnabledRaw as boolean | null) ?? true
  const grid = parseGridConfig(gridRaw)
  const { blocks } = parseHomeLayout(layoutRaw)

  // Fetch products for every admin-defined product row in parallel, keyed by
  // block id. Each row pulls its own filtered set + ratings.
  const productBlocks = blocks.filter(
    (b): b is ProductBlock => b.type === "products",
  )
  const rowEntries = await Promise.all(
    productBlocks.map(async (b) => {
      const products =
        b.mode === "manual"
          ? await getProductsByIds(b.manualProducts.map((p) => p.id))
          : await listProductsForSource(b.source, b.limit)
      const ratings = await getRatingSummaries(products.map((p) => p.id))
      return [b.id, { products, ratings }] as const
    }),
  )
  const rowData = new Map(rowEntries)

  // Recently-viewed cap (admin-set on its block).
  const recentlyViewedBlock = blocks.find(
    (b): b is StaticBlock => b.type === "static" && b.key === "recently_viewed",
  )
  const recentlyViewedLimit = recentlyViewedBlock
    ? staticBlockLimit(recentlyViewedBlock)
    : undefined

  // The unique storefront widgets. Rendered in the admin-configured order below;
  // the hero stays pinned to the top and is not part of the reorderable list.
  // Widgets that fetch their own data or self-hide when empty keep doing so.
  const staticViews: Record<StaticSectionKey, React.ReactNode> = {
    value_props: <ValueProps locale={typedLocale} />,
    shop_by: <ShopBy locale={typedLocale} />,
    track_order: (
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
    ),
    testimonials: <Testimonials locale={typedLocale} />,
    ugc_strip: <UgcStrip locale={typedLocale} />,
    whatsapp_signup: whatsappEnabled ? <WhatsappSignup locale={typedLocale} /> : null,
    recently_viewed: (
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-0">
        <RecentlyViewed
          locale={typedLocale}
          title={tProduct("recently_viewed")}
          config={grid}
          limit={recentlyViewedLimit}
        />
      </div>
    ),
  }

  return (
    <>
      <AdminEditBar
        dashboardHref={`/${typedLocale}/admin`}
        editHref={`/${typedLocale}/admin/settings`}
        editLabel="Edit hero"
      />
      <Hero products={heroProducts} locale={typedLocale} />

      {blocks
        .filter((b) => b.visible)
        .map((b) => {
          if (b.type === "static") {
            return (
              <Fragment key={`s:${b.key}`}>{staticViews[b.key]}</Fragment>
            )
          }
          const data = rowData.get(b.id)
          if (!data) return null
          return (
            <ProductRow
              key={`p:${b.id}`}
              title={typedLocale === "ar" ? b.titleAr : b.titleEn}
              products={data.products}
              ratings={data.ratings}
              locale={typedLocale}
              config={grid}
              ctaHref={resolveShopByHref(productBlockCtaHref(b), typedLocale)}
              viewAllLabel={t("view_all")}
              scope={`row:${b.id}`}
            />
          )
        })}

      {whatsappEnabled && <WhatsappPopup />}
    </>
  )
}
