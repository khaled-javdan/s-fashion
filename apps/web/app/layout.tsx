import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { getLocale } from "next-intl/server"
import {
  Cairo,
  Cormorant,
  IBM_Plex_Sans_Arabic,
  Nunito_Sans,
} from "next/font/google"

import { cn } from "@workspace/ui/lib/utils"
import "@workspace/ui/globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import {
  DEFAULT_LOCALE,
  isLocale,
  localeDirection,
  type Locale,
} from "@/lib/locale"

/**
 * Font strategy:
 *
 *   --font-sans     →  IBM Plex Sans Arabic (Arabic), Nunito Sans (Latin)
 *   --font-heading  →  Cairo (Arabic, heavier weights), Cormorant (Latin display)
 *
 * Each `next/font/google` call exposes a single CSS variable. We then chain
 * those variables together via the `--font-sans` / `--font-heading` compound
 * custom properties on `<html>` so a single Tailwind utility (`font-sans`,
 * `font-heading`) renders correctly for both scripts — the browser picks the
 * family with glyph coverage.
 */

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito-sans",
})

const cormorant = Cormorant({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
})

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-arabic",
})

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
})

export const metadata: Metadata = {
  title: {
    default: "S Fashion",
    template: "%s · S Fashion",
  },
  description:
    "S Fashion — luxury mukhawar (traditional Arabic dresses), delivered across the UAE.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3ece0",
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `getLocale()` resolves the active locale from `i18n.ts` (set per request).
  // For routes outside `/[locale]/...` (e.g. `/admin/*`) it falls back to the
  // default we configured. The admin shell (Track D) wraps itself in an
  // explicitly English `<div>` to override these `<html>` defaults.
  const resolved = await getLocale()
  const htmlLocale: Locale = isLocale(resolved) ? resolved : DEFAULT_LOCALE
  const htmlDir = localeDirection(htmlLocale)

  // Compose the font cascade. Arabic fonts come first so Arabic glyphs are
  // served directly from the localized webfont; Latin fonts come next as
  // fallback for mixed-script content. The system fallback is a safety net.
  const fontFamilyStyle = {
    "--font-sans":
      "var(--font-ibm-plex-arabic), var(--font-nunito-sans), system-ui, sans-serif",
    "--font-heading":
      "var(--font-cairo), var(--font-cormorant), Georgia, serif",
  } as React.CSSProperties

  return (
    <html
      lang={htmlLocale}
      dir={htmlDir}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        nunitoSans.variable,
        cormorant.variable,
        ibmPlexArabic.variable,
        cairo.variable,
      )}
      style={fontFamilyStyle}
    >
      <body className="min-h-svh bg-background font-sans text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
