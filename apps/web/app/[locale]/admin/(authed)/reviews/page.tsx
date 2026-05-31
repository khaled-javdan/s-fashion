import { getTranslations } from "next-intl/server"

import { NewReviewDialog } from "@/components/admin/reviews/new-review-dialog"
import {
  ReviewsTable,
  type ReviewRow,
} from "@/components/admin/reviews/reviews-table"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"
import { listAllProductsForAdmin } from "@/lib/repos/products.repo"
import { listAllReviews } from "@/lib/repos/reviews.repo"

/** Format a stored DateTime to the date input's yyyy-mm-dd, or "" when null. */
function toDateInput(d: Date | null): string {
  if (!d) return ""
  return d.toISOString().slice(0, 10)
}

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.reviews")

  const [reviews, products] = await Promise.all([
    listAllReviews(),
    listAllProductsForAdmin(),
  ])

  const productOptions = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
  }))
  const productById = new Map(productOptions.map((p) => [p.id, p]))

  const rows: ReviewRow[] = reviews.map((r) => {
    const product = r.productId ? productById.get(r.productId) : undefined
    return {
      id: r.id,
      rating: r.rating,
      authorName: r.authorName,
      authorHandle: r.authorHandle,
      body: r.body,
      source: r.source,
      productId: r.productId,
      imageUrl: r.imageUrl,
      featured: r.featured,
      isVisible: r.isVisible,
      displayDate: toDateInput(r.displayDate),
      sortOrder: r.sortOrder,
      isCustomerSubmitted: r.isCustomerSubmitted,
      productName: product
        ? locale === "ar"
          ? product.nameAr
          : product.nameEn
        : null,
      productSlug: product?.slug ?? null,
    }
  })

  // Customer submissions awaiting approval (hidden) — surfaced as a banner so
  // the moderation queue is obvious without scanning the table.
  const pendingCount = rows.filter(
    (r) => r.isCustomerSubmitted && !r.isVisible,
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl">{t("list.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("list.count", { count: rows.length })}
          </p>
        </div>
        <NewReviewDialog locale={locale} products={productOptions} />
      </div>

      {pendingCount > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("list.pending", { count: pendingCount })}
        </div>
      ) : null}

      <ReviewsTable reviews={rows} products={productOptions} locale={locale} />
    </div>
  )
}
