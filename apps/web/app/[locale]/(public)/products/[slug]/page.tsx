import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Separator } from "@workspace/ui/components/separator"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { AdminEditBar } from "@/components/admin-bar/admin-edit-bar"
import { ProductColorProvider } from "@/components/product/product-color-context"
import { ProductDescription } from "@/components/product/product-description"
import {
  ProductGallery,
  type GalleryImage,
} from "@/components/product/product-gallery"
import { ProductJsonLd } from "@/components/product/product-jsonld"
import { RecentlyViewed } from "@/components/product/recently-viewed"
import { RelatedProducts } from "@/components/product/related-products"
import { SizeChartModal } from "@/components/product/size-chart-modal"
import {
  VariantPicker,
  type PickerVariant,
} from "@/components/product/variant-picker"
import { LOCALES, type Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"
import { getProductBySlug, listSimilarProducts } from "@/lib/repos/products.repo"
import { getSetting } from "@/lib/repos/settings.repo"

const DEFAULT_MAX_QTY = 2

function canonicalUrl(locale: string, slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sfashion.ae"
  return `${base.replace(/\/$/, "")}/${locale}/products/${slug}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const product = await getProductBySlug(slug)
  if (!product) return {}

  const name = locale === "ar" ? product.nameAr : product.nameEn
  const description =
    (locale === "ar" ? product.descAr : product.descEn) ?? undefined
  const image = product.images[0]?.url

  return {
    title: name,
    description,
    alternates: { canonical: canonicalUrl(locale, slug) },
    openGraph: {
      title: name,
      description,
      images: image ? [image] : undefined,
      type: "website",
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)

  const typedLocale: Locale = locale
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const t = await getTranslations("product")

  const [maxQtySetting, sizeChart, whatsappNumber, similar] = await Promise.all([
    getSetting("order.max_qty_per_variant"),
    getSetting("size_chart.cm"),
    getSetting("contact.whatsapp_number"),
    listSimilarProducts({ excludeId: product.id, priceFils: product.priceFils }),
  ])
  const maxQtyPerVariant = maxQtySetting ?? DEFAULT_MAX_QTY

  const name = typedLocale === "ar" ? product.nameAr : product.nameEn
  const description = typedLocale === "ar" ? product.descAr : product.descEn
  const url = canonicalUrl(locale, slug)

  const galleryImages: GalleryImage[] = product.images.map((image) => ({
    url: image.url,
    alt: (typedLocale === "ar" ? image.altAr : image.altEn) ?? name,
    colorHex: image.colorHex,
  }))

  const pickerVariants: PickerVariant[] = product.variants.map((v) => ({
    id: v.id,
    colorHex: v.colorHex,
    colorNameAr: v.colorNameAr,
    colorNameEn: v.colorNameEn,
    size: v.size,
    stock: v.stock,
  }))

  const onSale =
    product.compareAtFils != null && product.compareAtFils > product.priceFils

  // Prefilled WhatsApp enquiry referencing the product name + canonical URL.
  const waText = t("share_whatsapp_text", { name, url })
  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(waText)}`
    : null

  return (
    <article className="mx-auto w-full max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-0 md:pb-8">
      <ProductJsonLd product={product} locale={typedLocale} url={url} />
      <AdminEditBar
        dashboardHref={`/${typedLocale}/admin`}
        editHref={`/${typedLocale}/admin/products/${product.id}`}
        editLabel="Edit product"
      />

      <ProductColorProvider>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <ProductGallery images={galleryImages} priority />

          {/* Details */}
          <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl tracking-wide sm:text-4xl">
              {name}
            </h1>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-medium">
                {formatAed(product.priceFils, typedLocale)}
              </span>
              {onSale ? (
                <>
                  <span className="text-muted-foreground/70 text-lg line-through">
                    {formatAed(product.compareAtFils!, typedLocale)}
                  </span>
                  <span className="bg-destructive text-destructive-foreground rounded-sm px-2 py-0.5 text-xs font-semibold uppercase">
                    {t("sale_badge")}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <VariantPicker
            product={{
              productId: product.id,
              slug: product.slug,
              nameAr: product.nameAr,
              nameEn: product.nameEn,
              priceFils: product.priceFils,
              imageUrl: product.images[0]?.url ?? null,
            }}
            variants={pickerVariants}
            locale={typedLocale}
            maxQtyPerVariant={maxQtyPerVariant}
          />

          <div className="flex flex-wrap items-center gap-4">
            <SizeChartModal rows={sizeChart?.rows ?? []} />
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {t("ask_on_whatsapp")}
              </a>
            ) : null}
          </div>

          {description ? (
            <>
              <Separator />
              <ProductDescription description={description} />
            </>
          ) : null}
          </div>
        </div>
      </ProductColorProvider>

      <RelatedProducts
        title={t("you_may_also_like")}
        products={similar}
        locale={typedLocale}
      />

      <RecentlyViewed
        locale={typedLocale}
        title={t("recently_viewed")}
        current={{
          slug: product.slug,
          nameEn: product.nameEn,
          nameAr: product.nameAr,
          imageUrl: product.images[0]?.url ?? null,
          priceFils: product.priceFils,
        }}
      />
    </article>
  )
}
