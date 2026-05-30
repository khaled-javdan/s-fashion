import { cn } from "@workspace/ui/lib/utils"

/**
 * The new UAE Dirham symbol (introduced 2025): a Latin "D" whose stem is crossed
 * by two horizontal strokes.
 *
 * Rendered as an inline SVG because the glyph is too new to exist in most system
 * fonts yet (a raw Unicode character would show a "tofu" box on many devices).
 * It scales with the surrounding font-size (`1em`) and inherits text colour via
 * `currentColor`, so it drops into any price string.
 *
 * NOTE: this path is a faithful approximation of the official mark. To use the
 * exact Central Bank of the UAE artwork, replace the <path> contents below with
 * the official SVG paths (keep `fill`/`stroke` as `currentColor`).
 */
export function DirhamSign({
  className,
  title = "AED",
}: {
  className?: string
  /** Accessible label; rendered as an SVG <title>. */
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block size-[0.92em] shrink-0", className)}
    >
      <title>{title}</title>
      {/* D stem */}
      <path
        d="M7.5 3.6V20.4"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      {/* D bowl */}
      <path
        d="M7.5 4.6H11.5C15.9 4.6 19 7.9 19 12C19 16.1 15.9 19.4 11.5 19.4H7.5"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* two horizontal strokes crossing the entire D */}
      <path
        d="M5.2 9.8H20.4"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M5.2 14.2H20.4"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  )
}
