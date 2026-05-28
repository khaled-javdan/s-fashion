"use client";

/**
 * Cookie consent banner.
 *
 * Shown on first visit when `localStorage.getItem("cookieConsent")` is null.
 * Accept / Decline persist the choice and bubble it up via `onChange` so the
 * parent `AnalyticsProvider` can re-render the pixel components.
 *
 * Strings come from the `cookie` translation namespace seeded by Track A in
 * `apps/web/messages/{ar,en}.json` (see SPEC.md §10).
 */
import { useTranslations } from "next-intl";

import { Button } from "@workspace/ui/components/button";

import type { ConsentChoice } from "./analytics-provider";

export interface CookieBannerProps {
  onChange: (choice: ConsentChoice) => void;
}

export function CookieBanner({ onChange }: CookieBannerProps) {
  const t = useTranslations("cookie");

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("message")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-foreground">
          {t("message")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange("decline")}
          >
            {t("decline")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onChange("accept")}
          >
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;
