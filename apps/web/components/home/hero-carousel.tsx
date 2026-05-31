"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

export type HeroSlide = {
  id: string
  href: string
  imageUrl: string
  /** When set, the slide plays this video instead of the image. */
  videoUrl?: string
  /** Poster frame for the video (also the reduced-motion still). */
  posterUrl?: string
  alt: string
  eyebrow: string
  title: string
  /** Formatted price string. */
  subtitle: string
  cta: string
}

type Props = {
  slides: HeroSlide[]
  isRtl: boolean
  autoplayMs?: number
}

/**
 * Slick, dependency-free hero carousel.
 *
 * Built on native CSS scroll-snap so touch swipe is buttery on mobile (where
 * almost all traffic lands, inside the Instagram in-app browser) with zero JS
 * per-frame cost. JS only layers on the niceties: autoplay, arrows, dot
 * indicators, and active-slide tracking.
 *
 * RTL-safe: active-slide detection compares slide centers to the viewport
 * center (direction-agnostic), and navigation uses `scrollIntoView` with a
 * logical `inline: "start"`, so it works identically in `/ar` and `/en`.
 * Respects `prefers-reduced-motion` and pauses on hover/focus/touch and when
 * the tab is hidden.
 */
export function HeroCarousel({ slides, isRtl, autoplayMs = 6000 }: Props) {
  const t = useTranslations("home")
  const trackRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const count = slides.length

  // Track the user's reduced-motion preference reactively, so videos fall back
  // to their poster still (and autoplay stays off) without a reload.
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  // Pause every hero video whenever the carousel scrolls offscreen, the tab is
  // hidden, or reduced motion is on — and resume only the active slide's video
  // when it's safe. Mirrors the autoplay gating below.
  useEffect(() => {
    const videos = videoRefs.current
    videos.forEach((v, i) => {
      if (!v) return
      const shouldPlay = onScreen && !reducedMotion && i === active
      if (shouldPlay) {
        void v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [active, onScreen, reducedMotion, count])

  // Track the active slide by nearest-center to the track viewport. This is
  // direction-agnostic, so it behaves the same under RTL and LTR.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    const measure = () => {
      frame = 0
      const trackRect = track.getBoundingClientRect()
      const center = trackRect.left + trackRect.width / 2
      let nearest = 0
      let min = Infinity
      slideRefs.current.forEach((el, i) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const c = r.left + r.width / 2
        const d = Math.abs(c - center)
        if (d < min) {
          min = d
          nearest = i
        }
      })
      setActive(nearest)
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    track.addEventListener("scroll", onScroll, { passive: true })
    measure()
    return () => {
      track.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [count])

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current
      const el = slideRefs.current[((index % count) + count) % count]
      if (!track || !el) return
      // Scroll ONLY the track horizontally (never the document). Using
      // `scrollIntoView` here would scroll the whole page back up to the hero
      // when the user has scrolled down to the grid. The delta is measured from
      // rendered positions, so it's correct in both RTL and LTR.
      const delta =
        el.getBoundingClientRect().left - track.getBoundingClientRect().left
      track.scrollBy({ left: delta, behavior: "smooth" })
    },
    [count],
  )

  // Pause autoplay when the carousel is scrolled out of view, so it never
  // rotates (and can't tug the page) while the user is looking at the grid.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { threshold: 0.3 },
    )
    io.observe(track)
    return () => io.disconnect()
  }, [])

  // Autoplay — paused on interaction / reduced motion / hidden tab / off-screen.
  useEffect(() => {
    if (paused || !onScreen || count <= 1) return
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }
    const id = window.setInterval(() => goTo(active + 1), autoplayMs)
    return () => window.clearInterval(id)
  }, [active, paused, onScreen, count, autoplayMs, goTo])

  // Pause while the tab is backgrounded.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft
  const NextIcon = isRtl ? ChevronLeft : ChevronRight

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("hero_carousel_label")}
      className="bg-muted border-border relative border-b"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <Link
            key={slide.id}
            href={slide.href}
            ref={(el) => {
              slideRefs.current[i] = el
            }}
            data-index={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            className="group relative h-[68svh] min-h-[440px] w-full shrink-0 snap-start overflow-hidden sm:h-[560px] lg:h-[680px]"
          >
            {slide.videoUrl && !reducedMotion ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el
                }}
                src={slide.videoUrl}
                poster={slide.posterUrl || slide.imageUrl}
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={slide.alt}
                className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
              />
            ) : (
              <Image
                src={slide.posterUrl && reducedMotion ? slide.posterUrl : slide.imageUrl}
                alt={slide.alt}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
              />
            )}
            {/* Legibility scrim — stronger toward the bottom-start text. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end pb-20 sm:pb-24 lg:pb-28">
              {/* Align the text to the same container as the header logo. */}
              <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 text-start sm:px-6 lg:px-0">
                {slide.eyebrow ? (
                  <p className="text-xs font-medium tracking-[0.3em] text-white/80 uppercase">
                    {slide.eyebrow}
                  </p>
                ) : null}
                {slide.title ? (
                  <h2 className="font-heading max-w-2xl text-3xl leading-tight tracking-wide text-balance text-white sm:text-5xl lg:text-6xl">
                    {slide.title}
                  </h2>
                ) : null}
                {slide.subtitle ? (
                  <p className="text-base font-medium text-white/90 sm:text-lg">
                    {slide.subtitle}
                  </p>
                ) : null}
                {slide.cta ? (
                  <span className="bg-background text-foreground mt-2 inline-flex w-fit items-center justify-center rounded-md px-6 py-2.5 text-sm font-semibold tracking-wide transition group-hover:opacity-90">
                    {slide.cta}
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {count > 1 ? (
        <>
          {/* Arrows — desktop affordance; touch users swipe. */}
          <button
            type="button"
            aria-label={t("hero_prev")}
            onClick={() => goTo(active - 1)}
            className="text-foreground bg-background/70 hover:bg-background focus-visible:ring-ring absolute top-1/2 start-3 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur transition focus-visible:ring-2 focus-visible:outline-none sm:flex"
          >
            <PrevIcon className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("hero_next")}
            onClick={() => goTo(active + 1)}
            className="text-foreground bg-background/70 hover:bg-background focus-visible:ring-ring absolute top-1/2 end-3 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur transition focus-visible:ring-2 focus-visible:outline-none sm:flex"
          >
            <NextIcon className="size-5" aria-hidden="true" />
          </button>

          {/* Dot indicators. */}
          <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={t("hero_goto", { number: i + 1 })}
                aria-current={i === active}
                onClick={() => goTo(i)}
                className={cn(
                  "focus-visible:ring-ring h-1.5 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  i === active
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/55 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
