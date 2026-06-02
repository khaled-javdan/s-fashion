"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { StarRating } from "@/components/reviews/star-rating"

export type Testimonial = {
  id: string
  rating: number
  body: string
  authorName: string
  authorHandle: string | null
}

type Props = {
  reviews: Testimonial[]
  isRtl: boolean
}

/**
 * Testimonials row with prev/next controls and page-dot indicators.
 *
 * Built on the same native scroll-snap foundation as the hero carousel: touch
 * users swipe with zero per-frame JS, and the arrows/dots layer on as an
 * affordance only when the row actually overflows its viewport. Navigation is
 * page-based (one viewport per step), so it scales whether two cards or a dozen.
 *
 * Direction-agnostic: scroll progress is read as `abs(scrollLeft) / max` and
 * programmatic scrolls flip sign under RTL, so it behaves identically in
 * `/ar` and `/en`.
 */
export function TestimonialsCarousel({ reviews, isRtl }: Props) {
  const t = useTranslations("reviews")
  const trackRef = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [active, setActive] = useState(0)
  const [overflow, setOverflow] = useState(false)

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const max = track.scrollWidth - track.clientWidth
    const hasOverflow = max > 1
    setOverflow(hasOverflow)
    if (!hasOverflow) {
      setPages(1)
      setActive(0)
      return
    }
    const pageCount = Math.max(2, Math.ceil(track.scrollWidth / track.clientWidth))
    setPages(pageCount)
    const progress = Math.abs(track.scrollLeft) / max
    setActive(Math.round(progress * (pageCount - 1)))
  }, [])

  // Re-measure on mount, when the card set changes, and on resize.
  useEffect(() => {
    measure()
    const track = trackRef.current
    if (!track) return
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [measure, reviews.length])

  // Track scroll position (rAF-throttled) to keep the active dot in sync.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    track.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      track.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [measure])

  const goToPage = useCallback(
    (page: number) => {
      const track = trackRef.current
      if (!track) return
      const clamped = Math.max(0, Math.min(page, pages - 1))
      const max = track.scrollWidth - track.clientWidth
      const target = (pages <= 1 ? 0 : clamped / (pages - 1)) * max
      track.scrollTo({ left: (isRtl ? -1 : 1) * target, behavior: "smooth" })
    },
    [pages, isRtl],
  )

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft
  const NextIcon = isRtl ? ChevronLeft : ChevronRight

  return (
    <div
      className="relative"
      aria-roledescription="carousel"
      aria-label={t("testimonials_label")}
    >
      <ul
        ref={trackRef}
        className="flex snap-x snap-proximity gap-4 overflow-x-auto scroll-smooth pb-4 sm:gap-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        {reviews.map((review) => (
          <li
            key={review.id}
            className="border-border bg-background flex w-72 shrink-0 snap-start flex-col gap-3 rounded-md border p-5 sm:w-80"
          >
            <StarRating value={review.rating} size="sm" />
            <p className="text-foreground/90 whitespace-pre-line text-sm leading-relaxed">
              {review.body}
            </p>
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

      {overflow ? (
        <>
          {/* Arrows — desktop affordance; touch users swipe. */}
          <button
            type="button"
            aria-label={t("testimonials_prev")}
            onClick={() => goToPage(active - 1)}
            disabled={active === 0}
            className="text-foreground bg-background/80 hover:bg-background focus-visible:ring-ring border-border absolute top-1/2 start-2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur transition focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <PrevIcon className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("testimonials_next")}
            onClick={() => goToPage(active + 1)}
            disabled={active >= pages - 1}
            className="text-foreground bg-background/80 hover:bg-background focus-visible:ring-ring border-border absolute top-1/2 end-2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur transition focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <NextIcon className="size-5" aria-hidden="true" />
          </button>

          {/* Dot indicators. */}
          <div className="mt-2 flex items-center justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={t("testimonials_goto", { number: i + 1 })}
                aria-current={i === active}
                onClick={() => goToPage(i)}
                className={cn(
                  "focus-visible:ring-ring h-1.5 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  i === active
                    ? "bg-foreground w-6"
                    : "bg-foreground/25 hover:bg-foreground/50 w-1.5",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
