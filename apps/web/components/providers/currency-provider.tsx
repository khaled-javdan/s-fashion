"use client"

import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { createContext, useCallback, useContext, useMemo } from "react"

import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { SHIP_TO_COOKIE, type CountryCode } from "@/lib/geo"
import type { Locale } from "@/lib/locale"

type CurrencyValue = {
  country: CountryCode
  currency: CurrencyCode
  rate: number
  enabledCountries: CountryCode[]
  /** Persist the ship-to country (cookie) and refresh server components. */
  setCountry: (country: CountryCode) => void
  /** Format an integer base-AED fils amount in the active currency. */
  format: (fils: number) => string
}

const CurrencyCtx = createContext<CurrencyValue | null>(null)

const ONE_YEAR = 60 * 60 * 24 * 365

export function CurrencyProvider({
  country,
  currency,
  rate,
  enabledCountries,
  children,
}: {
  country: CountryCode
  currency: CurrencyCode
  rate: number
  enabledCountries: CountryCode[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const locale = useLocale() as Locale

  const setCountry = useCallback(
    (next: CountryCode) => {
      document.cookie = `${SHIP_TO_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`
      router.refresh()
    },
    [router],
  )

  const value = useMemo<CurrencyValue>(
    () => ({
      country,
      currency,
      rate,
      enabledCountries,
      setCountry,
      format: (fils: number) => formatMoney(fils, { locale, currency, rate }),
    }),
    [country, currency, rate, enabledCountries, setCountry, locale],
  )

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>
}

export function useCurrency(): CurrencyValue {
  const ctx = useContext(CurrencyCtx)
  if (!ctx) {
    throw new Error("useCurrency must be used within a CurrencyProvider")
  }
  return ctx
}
