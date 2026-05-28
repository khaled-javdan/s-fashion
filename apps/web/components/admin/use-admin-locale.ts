import { useLocale } from "next-intl"

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/locale"

/**
 * Resolve the active admin locale. Wraps `useLocale()` so consumers don't
 * have to assert the string type themselves.
 */
export function useAdminLocale(): Locale {
  const raw = useLocale()
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}
