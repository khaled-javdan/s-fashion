import { getTranslations } from "next-intl/server"

import { StarRating } from "@/components/reviews/star-rating"
import type { Locale } from "@/lib/locale"
import { listFeaturedReviews } from "@/lib/repos/reviews.repo"

/** How many testimonials to surface. */
const TESTIMONIALS_TAKE = 12

/**
 * Home "What our customers say" section.
 *
 * Server Component. Pulls featured + visible reviews that carry a written
 * `body` (the photo-only ones live in the UGC strip instead) and renders them
 * as a responsive card grid. Renders `null` when there are none, so the home
 * page never shows an empty heading. RTL-aware.
 */
export async function Testimonials({ locale }: { locale: Locale }) {
  const t = await getTranslations("reviews")
  const featured = await listFeaturedReviews(TESTIMONIALS_TAKE)
  const reviews = featured.filter((r) => r.body && r.body.trim().length > 0)

  if (reviews.length === 0) return null

  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <section dir={dir} className="border-border bg-card border-y">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
        <div className="mb-8 flex flex-col gap-1">
          <h2 className="font-heading text-2xl tracking-wide sm:text-3xl">
            {t("testimonials_heading")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("testimonials_subheading")}
          </p>
        </div>

        <ul className="flex snap-x snap-proximity gap-4 overflow-x-auto pb-4 sm:gap-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="border-border bg-background flex w-72 shrink-0 snap-start flex-col gap-3 rounded-md border p-5 sm:w-80"
            >
              <StarRating value={review.rating} size="sm" />
              {review.body ? (
                <p className="text-foreground/90 whitespace-pre-line text-sm leading-relaxed">
                  {review.body}
                </p>
              ) : null}
              <div className="mt-auto flex flex-col items-start">
                <span className="font-medium">{review.authorName}</span>
                {review.authorHandle ? (
                  <span className="text-muted-foreground text-xs" dir="ltr">
                    {review.authorHandle}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
