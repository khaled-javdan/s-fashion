"use client"

import { Globe } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { useCurrency } from "@/components/providers/currency-provider"
import { currencyForCountry, type CountryCode } from "@/lib/geo"

/**
 * "Ship to country" selector. Picking a country sets the `ship_to` cookie which
 * drives the display currency everywhere and pre-fills the checkout country.
 */
export function ShipToSwitcher() {
  const t = useTranslations("country")
  const { country, enabledCountries, setCountry } = useCurrency()

  if (enabledCountries.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          aria-label={t("ship_to")}
        >
          <Globe className="size-4" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {country} · {currencyForCountry(country)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={country}
          onValueChange={(value) => setCountry(value as CountryCode)}
        >
          {enabledCountries.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {t(code)} — {currencyForCountry(code)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
