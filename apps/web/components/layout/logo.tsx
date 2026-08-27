import Image from "next/image"

import { cn } from "@workspace/ui/lib/utils"

import logoMark from "@/public/logo-mark.png"

/**
 * S Fashion brand lockup.
 *
 * The mark is the calligraphic "SF" monogram from `public/logo.png`, with its
 * white background stripped so it sits on the warm off-white page background
 * without a visible box. The wordmark is set in Cormorant (`font-wordmark`) to
 * echo the monogram's high-contrast serif — `font-heading` would render Latin
 * in Cairo, a sans, which fights the mark.
 *
 * Two lockups:
 *  - `Logo`        — horizontal, for the header and admin sidebar.
 *  - `LogoStacked` — wordmark over a letterspaced brand line, for the footer.
 */

/** Wordmark type treatment, shared by both lockups. */
const wordmark =
  "font-wordmark font-medium tracking-[0.3em] whitespace-nowrap uppercase"

/**
 * The monogram on its own — used where there is no room for the wordmark
 * (collapsed admin sidebar).
 *
 * `priority` is opt-in: the header renders above the fold and should preload
 * the mark; the footer and admin sidebar should not.
 */
export function LogoMark({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={logoMark}
      alt=""
      aria-hidden
      priority={priority}
      // Rendered at most ~40px tall anywhere on the site; cap the requested
      // width so the optimizer never ships the full 966px source.
      sizes="48px"
      className={cn("h-7 w-auto select-none", className)}
    />
  )
}

/**
 * Horizontal lockup: monogram + wordmark. Callers own the link/heading
 * wrapper so this stays usable inside <Link>, <h1>, or a plain <div>.
 */
export function Logo({
  className,
  markClassName,
  wordmarkClassName,
  priority = false,
  children = "SFashion",
}: {
  className?: string
  markClassName?: string
  wordmarkClassName?: string
  priority?: boolean
  children?: React.ReactNode
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} priority={priority} />
      <span className={cn(wordmark, "text-xl", wordmarkClassName)}>
        {children}
      </span>
    </span>
  )
}

/**
 * Stacked lockup: monogram beside the wordmark set over a micro brand line.
 * Taller than `Logo`, so it is reserved for the footer where there is room for
 * a proper brand moment.
 *
 * `brandLine` is localized copy passed in by the caller (this is a Server
 * Component-friendly presentational component, so it does no translation of
 * its own). It is set in `font-heading` rather than `font-wordmark` because
 * Cormorant carries no Arabic glyphs.
 */
export function LogoStacked({
  brandLine,
  className,
  markClassName,
  wordmarkClassName,
}: {
  brandLine: string
  className?: string
  markClassName?: string
  wordmarkClassName?: string
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark className={cn("h-10", markClassName)} />
      <span className="flex flex-col">
        <span className={cn(wordmark, "text-xl leading-none", wordmarkClassName)}>
          SFashion
        </span>
        {/* Arabic is a connected script — the wide Latin tracking breaks up
            the joins, so it is dialled back in RTL. */}
        <span className="mt-1.5 font-heading text-[0.5rem] tracking-[0.4em] whitespace-nowrap text-muted-foreground uppercase rtl:text-[0.5625rem] rtl:tracking-normal">
          {brandLine}
        </span>
      </span>
    </span>
  )
}
