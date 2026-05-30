import sanitizeHtml from "sanitize-html"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Tags/attributes the admin editor (Tiptap) can produce. Anything outside this
 * allowlist is stripped before the HTML reaches the page, so admin-authored
 * copy can never inject markup the editor itself can't create.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    // Harden every link regardless of what was stored.
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
      target: "_blank",
    }),
  },
}

const HTML_TAG = /<[a-z][\s\S]*>/i

/**
 * Strips all markup from rich-text HTML, yielding plain text for places that
 * must not contain tags — `<meta>` descriptions, Open Graph, JSON-LD, etc.
 * Whitespace is collapsed; pass `maxLength` to truncate.
 */
export function htmlToPlainText(html: string, maxLength?: number): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim()
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength).trimEnd() + "…"
  }
  return text
}

/**
 * Renders admin-authored rich text as formatted prose on the storefront.
 *
 * HTML is sanitised against the editor's allowlist before rendering. Legacy
 * plain-text copy (saved before the rich editor existed, so it has no tags) is
 * detected and rendered with preserved line breaks — no migration required.
 */
export function RichText({
  html,
  dir,
  className,
}: {
  html: string
  dir?: "ltr" | "rtl"
  className?: string
}) {
  if (!HTML_TAG.test(html)) {
    return (
      <p
        dir={dir}
        className={cn(
          "text-muted-foreground text-sm leading-relaxed whitespace-pre-line",
          className,
        )}
      >
        {html}
      </p>
    )
  }

  const clean = sanitizeHtml(html, SANITIZE_OPTIONS)

  return (
    <div
      dir={dir}
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "text-muted-foreground leading-relaxed",
        "prose-headings:text-foreground prose-headings:font-heading prose-headings:tracking-wide",
        "prose-a:text-foreground prose-strong:text-foreground",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
