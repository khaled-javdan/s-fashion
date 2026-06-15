"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Scroll a horizontal scroller so `child` is revealed — WITHOUT ever scrolling
 * the page. `Element.scrollIntoView` bubbles to every scrollable ancestor
 * including the window, so for a card below the fold it drags the whole page
 * down on mount (the storefront's "jumps down on load" bug). We instead nudge
 * only the container's own horizontal scroll, computed from live rects (RTL-safe).
 */
function scrollChildIntoViewX(
  container: HTMLElement | null,
  child: HTMLElement | undefined,
  align: "center" | "nearest",
) {
  if (!container || !child) return
  const c = container.getBoundingClientRect()
  const ch = child.getBoundingClientRect()
  let delta: number
  if (align === "center") {
    delta = ch.left + ch.width / 2 - (c.left + c.width / 2)
  } else {
    if (ch.left >= c.left && ch.right <= c.right) return // already fully visible
    delta = ch.left < c.left ? ch.left - c.left : ch.right - c.right
  }
  container.scrollBy({ left: delta, behavior: "smooth" })
}

export type CardSlide = { url: string; alt: string }
/**
 * `index` is the slide to scroll to, or -1 for a decorative (no-image) color.
 * `thumbUrl` is the small product photo shown in the swatch row; falls back to
 * a solid color dot when the color has no photo of its own.
 */
export type CardSwatch = {
  hex: string
  label: string
  index: number
  thumbUrl: string | null
}

type Props = {
  href: string
  slides: CardSlide[]
  swatches: CardSwatch[]
  sizes: string
  priority?: boolean
  dimmed?: boolean
  /** Non-interactive overlays (sale/stock badges) rendered over the image. */
  overlay?: React.ReactNode
  /** Slide index to show on mount (instant, no animation). Used by styles view. */
  initialSlide?: number
}

/**
 * Swipeable product-card media: a horizontal, scroll-snapping carousel of the
 * product's photos grouped by color, with hover arrows, dot indicators, and a
 * swatch row that jumps to each color's first photo.
 */
export function ProductCardMedia({
  href,
  slides,
  swatches,
  sizes,
  priority = false,
  dimmed = false,
  overlay,
  initialSlide,
}: Props) {
  const t = useTranslations("product")
  const scroller = useRef<HTMLDivElement>(null)
  const swatchScroller = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(initialSlide ?? 0)
  // Priority images are fetched before React hydrates, so they're already
  // available — skip the shimmer to prevent an unnecessary opacity flash.
  const [firstLoaded, setFirstLoaded] = useState(priority)
  const multi = slides.length > 1

  // Instantly position the scroller at the pre-selected colour's first slide.
  useEffect(() => {
    if (!initialSlide || initialSlide <= 0) return
    const el = scroller.current?.children[initialSlide] as HTMLElement | undefined
    if (scroller.current && el) {
      scroller.current.scrollLeft = el.offsetLeft
    }
  }, []) // mount only

  const goTo = (i: number) => {
    const el = scroller.current?.children[i] as HTMLElement | undefined
    scrollChildIntoViewX(scroller.current, el, "center")
  }

  // Direction-agnostic active-slide detection (works in LTR and RTL).
  const onScroll = () => {
    const c = scroller.current
    if (!c) return
    const center = c.getBoundingClientRect().left + c.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < c.children.length; i++) {
      const r = (c.children[i] as HTMLElement).getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - center)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    setActive(best)
  }

  // Which jumpable swatch the active slide belongs to (highest index ≤ active).
  let activeSwatch = -1
  swatches.forEach((s, i) => {
    if (s.index >= 0 && s.index <= active) activeSwatch = i
  })

  // Keep the active swatch visible in the scrollable swatch row. Scrolls only
  // the row itself — never the page (see scrollChildIntoViewX).
  useEffect(() => {
    if (activeSwatch < 0) return
    const ul = swatchScroller.current
    const li = ul?.children[activeSwatch] as HTMLElement | undefined
    scrollChildIntoViewX(ul, li, "nearest")
  }, [activeSwatch])

  if (slides.length === 0) {
    return <div className="bg-muted aspect-[3/4] w-full rounded-md" />
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted relative aspect-[3/4] w-full overflow-hidden rounded-md">
        {/* Shimmer visible while the first slide is still fetching.
            Sits behind the images so badges / overlay are unaffected. */}
        {!firstLoaded && (
          <div
            aria-hidden
            className="animate-pulse absolute inset-0 z-0 bg-inherit"
          />
        )}
        <div
          ref={scroller}
          onScroll={onScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s, i) => (
            <Link
              key={`${s.url}-${i}`}
              href={href}
              aria-hidden={i !== 0}
              tabIndex={i === 0 ? undefined : -1}
              className="relative block h-full w-full shrink-0 snap-center"
            >
              <Image
                src={s.url}
                alt={i === 0 ? s.alt : ""}
                fill
                priority={priority && i === 0}
                sizes={sizes}
                onLoad={i === 0 ? () => setFirstLoaded(true) : undefined}
                className={cn(
                  "object-cover transition-[opacity,transform] duration-500 group-hover:scale-105",
                  dimmed
                    ? "opacity-50 grayscale"
                    : i === 0 && !firstLoaded
                      ? "opacity-0"
                      : undefined,
                )}
              />
            </Link>
          ))}
        </div>

        {/* Badges / stock — must not capture pointer events so swipe + tap pass
            through to the slides. */}
        {overlay ? (
          <div className="pointer-events-none absolute inset-0">{overlay}</div>
        ) : null}

        {multi ? (
          <>
            {active > 0 ? (
              <button
                type="button"
                aria-label={t("carousel_prev")}
                onClick={() => goTo(active - 1)}
                className="bg-background/80 text-foreground hover:bg-background absolute start-2 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full p-1.5 opacity-0 shadow transition group-hover:opacity-100 sm:grid"
              >
                <ChevronLeft className="size-4 rtl:hidden" />
                <ChevronRight className="size-4 ltr:hidden" />
              </button>
            ) : null}
            {active < slides.length - 1 ? (
              <button
                type="button"
                aria-label={t("carousel_next")}
                onClick={() => goTo(active + 1)}
                className="bg-background/80 text-foreground hover:bg-background absolute end-2 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full p-1.5 opacity-0 shadow transition group-hover:opacity-100 sm:grid"
              >
                <ChevronRight className="size-4 rtl:hidden" />
                <ChevronLeft className="size-4 ltr:hidden" />
              </button>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i === active ? "bg-foreground" : "bg-foreground/30",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {swatches.length > 0 ? (
        <ul
          ref={swatchScroller}
          className="flex items-center gap-1.5 overflow-x-auto p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {swatches.map((s, i) =>
            s.index >= 0 ? (
              <li key={s.hex} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(s.index)}
                  aria-label={s.label}
                  aria-pressed={activeSwatch === i}
                  title={s.label || undefined}
                  className={cn(
                    "relative block size-7 overflow-hidden rounded-full border transition",
                    activeSwatch === i
                      ? "ring-foreground border-background ring-2"
                      : "border-border/70",
                  )}
                  style={s.thumbUrl ? undefined : { backgroundColor: s.hex }}
                >
                  {s.thumbUrl ? (
                    <Image
                      src={s.thumbUrl}
                      alt=""
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  ) : null}
                </button>
              </li>
            ) : (
              <li key={s.hex} className="shrink-0">
                <span
                  className="border-border/70 relative block size-7 overflow-hidden rounded-full border"
                  style={s.thumbUrl ? undefined : { backgroundColor: s.hex }}
                  title={s.label || undefined}
                  aria-hidden
                >
                  {s.thumbUrl ? (
                    <Image
                      src={s.thumbUrl}
                      alt=""
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  )
}
