"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js"
// SVG flag components keyed by ISO country code (data only — no chrome). We
// build the rest of the field ourselves on the design-system <Select>.
import flags from "react-phone-number-input/flags"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

import type { CountryCode } from "@/lib/geo"

import "./phone-field.css"

type PhoneFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Fires when the user picks a different country in the flag dropdown. */
  onCountryChange?: (country: CountryCode | undefined) => void
  /** Initial country for formatting + the flag dropdown. */
  defaultCountry?: CountryCode
  /** Restrict the picker to the countries we actually ship to. */
  countries?: CountryCode[]
  placeholder?: string
  /** Locale only affects the (translated) country names in the dropdown. */
  locale?: "en" | "ar"
  invalid?: boolean
  autoComplete?: string
}

// `flags` is a record of ISO code → SVG component taking a `title` prop.
const FLAGS = flags as Record<
  string,
  React.ComponentType<{ title?: string }> | undefined
>

function CountryFlag({
  country,
  title,
}: {
  country: CountryCode
  title: string
}) {
  const Flag = FLAGS[country]
  return (
    <span className="cn-phone-flag">{Flag ? <Flag title={title} /> : null}</span>
  )
}

/**
 * Country-picker phone field. The country segment is the shared Radix
 * <Select> (flag + calling code); the national number is a plain input. The
 * whole control is forced `dir="ltr"` — flag and `+code` inline-start, the
 * number after — because phone numbers read left-to-right even in an RTL
 * (Arabic) layout.
 *
 * Emits E.164 (`+9715XXXXXXXX`) via `onChange`, matching the `canonicalPhone()`
 * contract the checkout form + server expect. Formatting/validation come from
 * libphonenumber-js; the parent's resolver decides validity and toggles
 * `invalid`. Styling lives in `phone-field.css`.
 */
export function PhoneField({
  id,
  value,
  onChange,
  onCountryChange,
  defaultCountry = "AE",
  countries,
  placeholder,
  invalid = false,
  autoComplete = "tel",
}: PhoneFieldProps) {
  const t = useTranslations("country")
  const [country, setCountry] = React.useState<CountryCode>(defaultCountry)
  const [national, setNational] = React.useState("")
  // Tracks the controlled `value` we've reconciled with. Updated whenever we
  // emit (so our own change echoing back is a no-op) and during render below
  // when `value` changes from the outside — e.g. a form restored from
  // sessionStorage. This adjust-on-prop-change pattern avoids a sync effect.
  const [reconciled, setReconciled] = React.useState(value || "")

  if ((value || "") !== reconciled) {
    setReconciled(value || "")
    if (!value) {
      setNational("")
    } else {
      const parsed = parsePhoneNumberFromString(value)
      if (parsed?.country) setCountry(parsed.country as CountryCode)
      setNational(parsed ? parsed.formatNational() : value)
    }
  }

  const list = countries && countries.length > 0 ? countries : [defaultCountry]

  function emit(nextCountry: CountryCode, nationalText: string) {
    const digits = nationalText.replace(/\D/g, "")
    let e164 = ""
    if (digits) {
      const parsed = parsePhoneNumberFromString(digits, nextCountry)
      e164 = parsed
        ? parsed.number
        : `+${getCountryCallingCode(nextCountry)}${digits}`
    }
    setReconciled(e164)
    onChange(e164)
  }

  function handleCountry(next: CountryCode) {
    setCountry(next)
    onCountryChange?.(next)
    // Re-key the existing digits to the new country's national format.
    const reformatted = new AsYouType(next).input(national.replace(/\D/g, ""))
    setNational(reformatted)
    emit(next, reformatted)
  }

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    // The input only ever holds the *national* number — never the country
    // code or a leading "+". Strip everything but digits, then re-format; the
    // calling code shown in the picker is appended automatically in `emit`.
    const digits = event.target.value.replace(/\D/g, "")
    const formatted = new AsYouType(country).input(digits)
    setNational(formatted)
    emit(country, formatted)
  }

  return (
    <div
      dir="ltr"
      className={cn("cn-phone-field", invalid && "cn-phone-field--invalid")}
    >
      <Select
        value={country}
        onValueChange={(v) => handleCountry(v as CountryCode)}
      >
        <SelectTrigger
          className="cn-phone-country h-full w-fit gap-1.5 rounded-none border-0 bg-transparent px-2 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0"
          aria-label={t(country)}
          aria-invalid={invalid || undefined}
        >
          <CountryFlag country={country} title={t(country)} />
          <span className="cn-phone-code">+{getCountryCallingCode(country)}</span>
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          className="cn-phone-menu"
        >
          {list.map((code) => (
            <SelectItem key={code} value={code}>
              <span className="cn-phone-option">
                <CountryFlag country={code} title={t(code)} />
                <span className="cn-phone-name">{t(code)}</span>
                <span className="cn-phone-code-item">
                  +{getCountryCallingCode(code)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        id={id}
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete={autoComplete}
        className="cn-phone-number"
        placeholder={placeholder}
        value={national}
        onChange={handleInput}
        aria-invalid={invalid || undefined}
      />
    </div>
  )
}
