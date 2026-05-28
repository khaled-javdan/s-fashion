"use client";

/**
 * AnalyticsProvider
 *
 * Top-level client component that orchestrates cookie consent + tracking
 * pixels. It:
 *
 *   1. Reads the consent choice from `localStorage["cookieConsent"]` on
 *      mount.
 *   2. Renders the cookie banner if no choice has been made.
 *   3. Mounts the Meta + TikTok pixel components only when the user has
 *      accepted.
 *
 * ─── TODO(post-merge): mount this into the root layout ────────────────
 *
 * Track A owns `apps/web/app/layout.tsx`. To avoid a merge conflict, Track
 * C does NOT touch the root layout — wire-up is done manually after both
 * tracks land:
 *
 *   // apps/web/app/layout.tsx
 *   import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
 *   …
 *   <body>
 *     {children}
 *     <AnalyticsProvider />   // ← add as a sibling of {children}
 *   </body>
 *
 * The component is self-contained: it renders the cookie banner and pixel
 * tags into the document; the parent does not pass any props. It must be
 * mounted inside an `<NextIntlClientProvider>` (or any other next-intl
 * provider Track A sets up) because the cookie banner calls
 * `useTranslations("cookie")`.
 *
 * ─────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useState } from "react";

import { CookieBanner } from "./cookie-banner";
import { MetaPixel } from "./meta-pixel";
import { TikTokPixel } from "./tiktok-pixel";

export type ConsentChoice = "accept" | "decline";
type ConsentState = ConsentChoice | "unknown";

const STORAGE_KEY = "cookieConsent";

function readStoredConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "accept" || raw === "decline") return raw;
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function AnalyticsProvider() {
  // We start as `unknown` and never render anything on the server. The
  // banner + pixels are mounted only after hydration once we've read
  // localStorage.
  const [consent, setConsent] = useState<ConsentState>("unknown");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydration: localStorage is unavailable during SSR, so we read it
    // post-mount and flip both flags in one render. The cascading-render
    // cost is one extra render on first mount, which is the standard
    // pattern for consent banners.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readStoredConsent());
    setHydrated(true);
  }, []);

  const handleChange = useCallback((choice: ConsentChoice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // ignore quota / privacy-mode errors — we still update in-memory
      // state so the banner closes for the current session.
    }
    setConsent(choice);
  }, []);

  if (!hydrated) return null;

  return (
    <>
      {consent === "unknown" ? <CookieBanner onChange={handleChange} /> : null}
      {consent === "accept" ? (
        <>
          <MetaPixel />
          <TikTokPixel />
        </>
      ) : null}
    </>
  );
}

export default AnalyticsProvider;
