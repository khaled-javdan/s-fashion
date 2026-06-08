"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

import { useProductColor } from "./product-color-context"

export type GalleryImage = {
  url: string
  alt: string
  /** Color this photo depicts, matched to the selected variant color. */
  colorHex?: string | null
}

type Props = {
  images: GalleryImage[]
  /** Mark the first image as priority for LCP. */
  priority?: boolean
}

/**
 * Product gallery.
 *
 * - Mobile: a horizontally snap-scrolling, swipeable strip whose dot indicators
 *   track the scroll position (via IntersectionObserver) and can be tapped to
 *   scroll to an image.
 * - Desktop (`lg:`): a large active image with a vertical thumbnail strip.
 * - Any image opens a full-screen lightbox with pinch / double-tap / drag zoom.
 */
export function ProductGallery({ images, priority = false }: Props) {
  const t = useTranslations("product")
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const stripRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Keep the mobile dots in sync with the scroll position.
  useEffect(() => {
    const root = stripRef.current
    if (!root || images.length < 2) return

    const slides = slideRefs.current.filter(Boolean) as HTMLElement[]
    const ratios = new Map<number, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = slides.indexOf(entry.target as HTMLElement)
          if (index !== -1) ratios.set(index, entry.intersectionRatio)
        }
        let bestIndex = 0
        let bestRatio = -1
        ratios.forEach((ratio, index) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestIndex = index
          }
        })
        setActive(bestIndex)
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [images.length])

  const scrollToSlide = useCallback((index: number) => {
    slideRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [])

  const openLightboxAt = useCallback((index: number) => {
    setActive(index)
    setLightboxOpen(true)
  }, [])

  // When the shopper picks a color, jump to that color's first photo (desktop
  // active image + mobile strip). No-op for untagged products or unknown colors.
  const selectedColorHex = useProductColor()?.selectedColorHex ?? null
  // The default color is published on mount; we set the active image for it but
  // must NOT scroll on that first run, or the page/strip jumps on PDP load.
  // Subsequent (user-initiated) color changes do scroll into view.
  const didMountColor = useRef(false)
  useEffect(() => {
    if (!selectedColorHex) return
    const index = images.findIndex((img) => img.colorHex === selectedColorHex)
    if (index >= 0) {
      // Reactive to the selected color, paired with a DOM scroll side effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(index)
      if (didMountColor.current) scrollToSlide(index)
    }
    didMountColor.current = true
    // `images` is stable for a given product render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColorHex])

  if (images.length === 0) {
    return (
      <div className="bg-muted aspect-[3/4] w-full rounded-md" aria-hidden />
    )
  }

  const activeImage = images[active] ?? images[0]!

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start">
      {/* Active image (desktop) + lightbox trigger */}
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label={t("open_image")}
        className="bg-muted relative hidden aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-md lg:block"
      >
        <Image
          src={activeImage.url}
          alt={activeImage.alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover"
        />
      </button>

      {/* Swipeable strip (mobile) */}
      <div className="lg:hidden">
        <div
          ref={stripRef}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <button
              key={image.url}
              ref={(el) => {
                slideRefs.current[index] = el
              }}
              type="button"
              onClick={() => openLightboxAt(index)}
              aria-label={t("thumbnail_label", { number: index + 1 })}
              className="bg-muted relative aspect-[3/4] w-full shrink-0 snap-center cursor-zoom-in overflow-hidden rounded-md"
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                priority={priority && index === 0}
                sizes="100vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
        {images.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2">
            {images.map((image, index) => (
              <button
                key={image.url}
                type="button"
                onClick={() => scrollToSlide(index)}
                aria-label={t("thumbnail_label", { number: index + 1 })}
                aria-current={index === active}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === active
                    ? "bg-foreground w-4"
                    : "bg-border hover:bg-muted-foreground w-1.5",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Thumbnail strip (desktop) */}
      {images.length > 1 ? (
        <div className="hidden gap-2 lg:flex lg:flex-col">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={index === active}
              aria-label={t("thumbnail_label", { number: index + 1 })}
              className={cn(
                "bg-muted relative size-16 shrink-0 overflow-hidden rounded-md border-2 transition",
                index === active ? "border-foreground" : "border-transparent",
              )}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <Lightbox
        images={images}
        index={active}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setActive}
      />
    </div>
  )
}

type LightboxProps = {
  images: GalleryImage[]
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
}

function Lightbox({
  images,
  index,
  open,
  onOpenChange,
  onIndexChange,
}: LightboxProps) {
  const t = useTranslations("product")
  const current = images[index] ?? images[0]!
  const hasMany = images.length > 1

  const goPrev = useCallback(() => {
    onIndexChange((index - 1 + images.length) % images.length)
  }, [index, images.length, onIndexChange])

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % images.length)
  }, [index, images.length, onIndexChange])

  // Keyboard navigation when the lightbox is open.
  useEffect(() => {
    if (!open || !hasMany) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, hasMany, goPrev, goNext])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-w-none flex-col border-0 bg-black/95 p-0 shadow-none sm:h-[92dvh] sm:max-w-4xl sm:rounded-lg"
      >
        <DialogTitle className="sr-only">{current.alt}</DialogTitle>

        {/* Zoomable viewer — remounts per image so zoom resets on change. */}
        <ZoomableImage
          key={current.url}
          src={current.url}
          alt={current.alt}
          onSwipePrev={hasMany ? goPrev : undefined}
          onSwipeNext={hasMany ? goNext : undefined}
        />

        {hasMany ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={t("previous_image")}
              className="absolute start-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25"
            >
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t("next_image")}
              className="absolute end-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25"
            >
              <ChevronRight className="size-5 rtl:rotate-180" />
            </button>

            <div className="absolute bottom-4 start-1/2 z-10 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
              {images.map((image, i) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={t("thumbnail_label", { number: i + 1 })}
                  aria-current={i === index}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-4 bg-white" : "w-1.5 bg-white/40",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="absolute end-2 top-2 z-10 rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25"
        >
          <X className="size-5" />
        </button>
      </DialogContent>
    </Dialog>
  )
}

const MAX_SCALE = 4
const ZOOM_STEP = 2.5
const SWIPE_THRESHOLD = 60

type ZoomableImageProps = {
  src: string
  alt: string
  /** Called on a horizontal swipe toward the start edge (when not zoomed). */
  onSwipePrev?: () => void
  /** Called on a horizontal swipe toward the end edge (when not zoomed). */
  onSwipeNext?: () => void
}

/**
 * A single image with pinch-to-zoom (two fingers), double-tap / double-click
 * zoom, and drag-to-pan when zoomed. When at rest (scale 1) a horizontal swipe
 * changes the image. All gestures are handled via pointer events so mouse and
 * touch share one code path.
 */
function ZoomableImage({
  src,
  alt,
  onSwipePrev,
  onSwipeNext,
}: ZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [gesturing, setGesturing] = useState(false)

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStart = useRef({ dist: 0, scale: 1 })
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const tap = useRef({ x: 0, y: 0, moved: false })
  const lastTapEnd = useRef(0)

  const clamp = useCallback(
    (s: number, o: { x: number; y: number }) => {
      const el = containerRef.current
      if (!el) return o
      const maxX = (el.clientWidth * (s - 1)) / 2
      const maxY = (el.clientHeight * (s - 1)) / 2
      return {
        x: Math.min(maxX, Math.max(-maxX, o.x)),
        y: Math.min(maxY, Math.max(-maxY, o.y)),
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setGesturing(true)

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        scale,
      }
    } else if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
      tap.current = { x: e.clientX, y: e.clientY, moved: false }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      const next = Math.min(
        MAX_SCALE,
        Math.max(1, (pinchStart.current.scale * dist) / pinchStart.current.dist),
      )
      setScale(next)
      setOffset((o) => clamp(next, o))
      tap.current.moved = true
      return
    }

    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) tap.current.moved = true

    if (scale > 1) {
      setOffset(
        clamp(scale, { x: panStart.current.ox + dx, y: panStart.current.oy + dy }),
      )
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const released = pointers.current.get(e.pointerId)
    pointers.current.delete(e.pointerId)

    // Swipe to change image — only when at rest and not a multi-touch gesture.
    if (
      scale === 1 &&
      released &&
      tap.current.moved &&
      pointers.current.size === 0
    ) {
      const dx = e.clientX - tap.current.x
      const dy = e.clientY - tap.current.y
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) onSwipePrev?.()
        else onSwipeNext?.()
      }
    }

    // Double-tap / double-click toggles zoom (only on a clean, stationary tap).
    if (!tap.current.moved && pointers.current.size === 0) {
      const now = Date.now()
      if (now - lastTapEnd.current < 300) {
        if (scale > 1) reset()
        else setScale(ZOOM_STEP)
        lastTapEnd.current = 0
      } else {
        lastTapEnd.current = now
      }
    }

    if (pointers.current.size === 0) setGesturing(false)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: "none" }}
      className={cn(
        "relative flex-1 select-none overflow-hidden",
        scale > 1 ? "cursor-grab" : "cursor-zoom-in",
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: gesturing ? "none" : "transform 180ms ease-out",
          transformOrigin: "center",
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain"
          draggable={false}
          priority
        />
      </div>
    </div>
  )
}
