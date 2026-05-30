/**
 * i18n routing middleware.
 *
 * Note: Next.js 16 renamed `middleware.ts` to `proxy.ts`. The old filename is
 * still supported for backward compatibility, and SPEC.md §8 (Track A) pins
 * this convention to keep the import path stable for downstream tracks.
 *
 * This middleware delegates entirely to `next-intl`:
 *  - `/`             → redirected to `/{DEFAULT_LOCALE}` (Arabic).
 *  - `/ar/...`       → served.
 *  - `/en/...`       → served.
 *  - `/admin/...`    → redirected to `/{DEFAULT_LOCALE}/admin/...`. Admin is
 *                      bilingual; locale lives under the same prefix as the
 *                      public site.
 *  - `/api/*`, `_next/*` and static assets are excluded.
 */

import createMiddleware from "next-intl/middleware"

import { DEFAULT_LOCALE, LOCALES } from "@/lib/locale"

export default createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
})

export const config = {
  // Match every request path EXCEPT:
  //   - /api/* (API routes)
  //   - /_next/* (Next.js internals)
  //   - common metadata files
  //   - anything with a file extension (assets in /public, fonts, images, etc.)
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
}
