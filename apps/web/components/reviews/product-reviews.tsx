import Image from "next/image"
import { getTranslations } from "next-intl/server"

import { Badge } from "@workspace/ui/components/badge"

import { ReviewSubmitForm } from "@/components/reviews/review-submit-form"
import { StarRating } from "@/components/reviews/star-rating"
import type { Locale } from "@/lib/locale"
import {
  getProductRatingSummary,
  listProductReviews,
} from "@/lib/repos/reviews.repo"

type Props = {
  productId: string
  locale: Locale
}

/**
 * PDP reviews panel (rendered inside the product "Reviews" tab).
 *
 * Server Component. Fetches the product's rating summary + visible reviews in
 * parallel, then renders the aggregate `StarRating`, the list of review cards
 * (bodies shown exactly as written), and the customer "Write a review" form.
 * Unlike the social-proof rails, this always renders — when there are no
 * reviews yet it shows an encouraging empty state above the form.
 */
export async function ProductReviews({ productId, locale }: Props) {
  const t = await getTranslations("reviews")
  const [summary, reviews] = await Promise.all([
    getProductRatingSummary(productId),
    listProductReviews(productId),
  ])

  const dir = locale === "ar" ? "rtl" : "ltr"
  const dateFormat = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-AE" : "en-AE",
    { year: "numeric", month: "long", day: "numeric" },
  )

  return (
    <section dir={dir} className="flex flex-col gap-8" aria-label={t("pdp_heading")}>
      {reviews.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <StarRating value={summary.average} count={summary.count} size="md" />
          </div>

          <ul className="grid gap-6 sm:grid-cols-2">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="border-border bg-card flex flex-col gap-3 rounded-md border p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{review.authorName}</span>
                    {review.authorHandle ? (
                      <span className="text-muted-foreground text-xs" dir="ltr">
                        {review.authorHandle}
                      </span>
                    ) : null}
                  </div>
                  {review.source ? (
                    <Badge variant="outline" className="capitalize">
                      {review.source}
                    </Badge>
                  ) : null}
                </div>

                <StarRating value={review.rating} size="sm" />

                {review.body ? (
                  <p className="text-foreground/90 whitespace-pre-line text-sm leading-relaxed">
                    {review.body}
                  </p>
                ) : null}

                {review.imageUrl ? (
                  <div className="relative aspect-square w-24 overflow-hidden rounded-md border">
                    <Image
                      src={review.imageUrl}
                      alt={review.authorName}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                ) : null}

                {review.displayDate ? (
                  <time
                    dateTime={review.displayDate.toISOString()}
                    className="text-muted-foreground text-xs"
                  >
                    {dateFormat.format(review.displayDate)}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      )}

      <ReviewSubmitForm productId={productId} locale={locale} />
    </section>
  )
}
