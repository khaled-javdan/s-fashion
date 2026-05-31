import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { prisma } from "@workspace/db"

import type { Locale } from "@/lib/locale"
import { listFeaturedReviews } from "@/lib/repos/reviews.repo"

/** How many photos to show in the strip. */
const UGC_TAKE = 16

/**
 * Home "As seen on Instagram" UGC strip.
 *
 * Server Component. Pulls featured + visible reviews that carry an `imageUrl`
 * and renders them as a horizontally-scrolling photo strip; each photo links to
 * its product when `productId` is set. Renders `null` when there are none.
 * RTL-aware (the strip scrolls in the reading direction).
 */
export async function UgcStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations("reviews")
  const featured = await listFeaturedReviews(UGC_TAKE)
  const photos = featured.filter((r) => r.imageUrl)

  if (photos.length === 0) return null

  // Resolve slugs for the photos that link to a product, in one query.
  const productIds = [
    ...new Set(photos.map((p) => p.productId).filter((id): id is string => Boolean(id))),
  ]
  const slugById = new Map<string, string>()
  if (productIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, slug: true },
    })
    for (const p of products) slugById.set(p.id, p.slug)
  }

  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <section dir={dir} className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-heading text-2xl tracking-wide sm:text-3xl">
          {t("ugc_heading")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("ugc_subheading")}</p>
      </div>

      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {photos.map((photo) => {
          const slug = photo.productId ? slugById.get(photo.productId) : undefined
          const image = (
            <div className="bg-muted relative aspect-square w-40 shrink-0 snap-start overflow-hidden rounded-md sm:w-48">
              <Image
                src={photo.imageUrl as string}
                alt={photo.authorName}
                fill
                sizes="(min-width: 640px) 192px, 160px"
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
              {photo.authorHandle ? (
                <span
                  className="bg-background/80 text-foreground absolute bottom-1 start-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  dir="ltr"
                >
                  {photo.authorHandle}
                </span>
              ) : null}
            </div>
          )
          return (
            <li key={photo.id}>
              {slug ? (
                <Link href={`/${locale}/products/${slug}`} aria-label={photo.authorName}>
                  {image}
                </Link>
              ) : (
                image
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
