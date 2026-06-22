"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useForm, type Resolver } from "react-hook-form"
import { parsePhoneNumberFromString } from "libphonenumber-js"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { Emirate } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { OrderSummary } from "@/app/[locale]/(public)/checkout/order-summary"
import { PhoneField } from "@/components/forms/phone-field"
import {
  TurnstileWidget,
  type TurnstileHandle,
} from "@/app/[locale]/(public)/checkout/turnstile-widget"
import {
  applyCouponAction,
  createOrderAction,
} from "@/app/[locale]/(public)/checkout/actions"
import { useCurrency } from "@/components/providers/currency-provider"
import { beginCheckout } from "@/lib/analytics/data-layer"
import {
  selectItems,
  selectHasHydrated,
  selectSubtotalFils,
  useCartStore,
} from "@/lib/cart-store"
import { addBreadcrumb } from "@/lib/client/report-client-error"
import { countryHasEmirates, type CountryCode } from "@/lib/geo"
import type { Locale } from "@/lib/locale"
import type { ShippingConfig } from "@/lib/shipping-config"

// Client-safe literal list — importing the Emirate runtime enum from
// @workspace/db here would pull the Prisma client (node:fs) into the browser
// bundle. `satisfies` keeps this in lockstep with the Prisma enum.
const EMIRATES = [
  "ABU_DHABI",
  "DUBAI",
  "SHARJAH",
  "AJMAN",
  "UMM_AL_QUWAIN",
  "RAS_AL_KHAIMAH",
  "FUJAIRAH",
] as const satisfies readonly Emirate[]

const CITIES_BY_EMIRATE: Record<Emirate, { en: string; ar: string }[]> = {
  ABU_DHABI: [
    { en: "Abu Dhabi", ar: "أبوظبي" },
    { en: "Al Ain", ar: "العين" },
    { en: "Al Dhafra", ar: "الظفرة" },
    { en: "Khalifa City", ar: "مدينة خليفة" },
    { en: "Mohammed Bin Zayed City", ar: "مدينة محمد بن زايد" },
    { en: "Mussafah", ar: "مصفح" },
    { en: "Baniyas", ar: "بني ياس" },
  ],
  DUBAI: [
    { en: "Dubai", ar: "دبي" },
  ],
  SHARJAH: [
    { en: "Sharjah", ar: "الشارقة" },
    { en: "Khor Fakkan", ar: "خورفكان" },
    { en: "Kalba", ar: "كلباء" },
    { en: "Dibba Al Hisn", ar: "دبا الحصن" },
    { en: "Dhaid", ar: "الذيد" },
  ],
  AJMAN: [
    { en: "Ajman", ar: "عجمان" },
  ],
  UMM_AL_QUWAIN: [
    { en: "Umm Al Quwain", ar: "أم القيوين" },
  ],
  RAS_AL_KHAIMAH: [
    { en: "Ras Al Khaimah", ar: "رأس الخيمة" },
    { en: "Al Jazeera Al Hamra", ar: "الجزيرة الحمراء" },
    { en: "Khuzam", ar: "خزام" },
    { en: "Digdaga", ar: "دقداقة" },
  ],
  FUJAIRAH: [
    { en: "Fujairah", ar: "الفجيرة" },
    { en: "Dibba Al Fujairah", ar: "دبا الفجيرة" },
  ],
}

type CheckoutFormValues = {
  name: string
  phone: string
  email: string
  country: CountryCode
  emirate: Emirate | ""
  city: string
  addressLine1: string
  addressLine2: string
  notes: string
  marketingConsent: boolean
}

const DEFAULT_VALUES: CheckoutFormValues = {
  name: "",
  phone: "",
  email: "",
  country: "AE",
  emirate: "",
  city: "",
  addressLine1: "",
  addressLine2: "",
  notes: "",
  marketingConsent: false,
}

// sessionStorage key for the in-progress checkout form (survives accidental
// reloads / navigation; cleared on successful order). Scoped to sessionStorage
// — not localStorage — so it doesn't linger across browser sessions.
//
// Versioned: when the persisted field shape changes (e.g. the emirate→city
// map), bump the suffix so stale data written by an older bundle is discarded
// on restore instead of being fed into a renderer that assumes the new shape.
// Restoring a v1 form once crashed checkout — a saved emirate key that no
// longer existed indexed `CITIES_BY_EMIRATE` to `undefined` (TypeError on
// `.length` during render).
const FORM_STORAGE_KEY = "s-fashion-checkout-form-v2"
const LEGACY_FORM_STORAGE_KEYS = ["s-fashion-checkout-form"] as const

/**
 * Map a server-reported field name (the `OrderCreateInput` shape) onto a form
 * field. Only `customerName` differs from the client field name (`name`); the
 * rest line up. Returns null for anything not directly editable in the form.
 */
function serverFieldToFormField(
  field: string | undefined,
): keyof CheckoutFormValues | null {
  if (!field) return null
  if (field === "customerName") return "name"
  const known: readonly (keyof CheckoutFormValues)[] = [
    "name",
    "phone",
    "email",
    "country",
    "emirate",
    "city",
    "addressLine1",
    "addressLine2",
    "notes",
    "marketingConsent",
  ]
  return (known as readonly string[]).includes(field)
    ? (field as keyof CheckoutFormValues)
    : null
}

/**
 * Single-page checkout form (Contact + Delivery sections) with a sticky order
 * summary on desktop. Validation is done with a manual Zod-free resolver that
 * maps directly to translated messages — the authoritative validation still
 * runs server-side in the action.
 *
 * Flow:
 *  1. "Place order" → `createOrderAction`. On success, clear the cart and
 *     navigate to the confirmation page.
 */
export function CheckoutForm({
  shippingConfig,
  defaultCountry,
  enabledCountries,
}: {
  shippingConfig: ShippingConfig
  defaultCountry: CountryCode
  enabledCountries: CountryCode[]
}) {
  const t = useTranslations("checkout")
  const tCoupon = useTranslations("checkout.coupon")
  const locale = useLocale() as Locale
  const router = useRouter()
  const { setCountry } = useCurrency()

  const items = useCartStore(selectItems)
  const hasHydrated = useCartStore(selectHasHydrated)
  const subtotalFils = useCartStore(selectSubtotalFils)
  const clear = useCartStore((s) => s.clear)

  const [submitting, setSubmitting] = useState(false)

  // GA4 begin_checkout → dataLayer, once the cart has hydrated and is non-empty.
  // Guarded so it fires a single time per checkout-page mount, not on every
  // cart change.
  const beginCheckoutFired = useRef(false)
  useEffect(() => {
    if (beginCheckoutFired.current || !hasHydrated || items.length === 0) return
    beginCheckoutFired.current = true
    beginCheckout({
      lines: items.map((i) => ({
        variantId: i.variantId,
        nameEn: i.nameEn,
        unitPriceFils: i.unitPriceFils,
        quantity: i.quantity,
      })),
      subtotalFils,
    })
  }, [hasHydrated, items, subtotalFils])

  // Coupon state (display preview). The applied code is sent with the order and
  // re-validated server-side, so this is best-effort UI only.
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [couponDiscountFils, setCouponDiscountFils] = useState(0)
  const [couponApplying, setCouponApplying] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  /** Map a validateCoupon reason to its translated message. */
  function couponReasonMessage(reason: string): string {
    const known = new Set([
      "not_found",
      "inactive",
      "expired",
      "not_started",
      "below_min",
      "first_order_only",
      "max_redemptions",
      "per_customer_limit",
      "phone_required",
      "invalid_request",
    ])
    return tCoupon(`error.${known.has(reason) ? reason : "invalid_request"}`)
  }

  // Client-side validation resolver. Mirrors the server schema's rules and
  // returns translated messages.
  const resolver: Resolver<CheckoutFormValues> = async (values) => {
    const errors: Record<string, { type: string; message: string }> = {}

    if (values.name.trim().length < 2) {
      errors.name = { type: "min", message: t("name_too_short") }
    }
    // PhoneField emits E.164 (already carries the country code); the country arg
    // is a harmless fallback for any national-format value.
    const parsedPhone = parsePhoneNumberFromString(
      values.phone.trim(),
      values.country,
    )
    if (!parsedPhone || !parsedPhone.isValid()) {
      errors.phone = { type: "phone", message: t("invalid_phone") }
    }
    if (!values.email.trim()) {
      errors.email = { type: "required", message: t("field_required") }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = { type: "email", message: t("invalid_email") }
    }
    if (!values.country) {
      errors.country = { type: "required", message: t("field_required") }
    }
    if (values.country === "AE" && !values.emirate) {
      errors.emirate = { type: "required", message: t("field_required") }
    }
    if (values.city.trim().length < 1) {
      errors.city = { type: "required", message: t("field_required") }
    }
    if (values.addressLine1.trim().length < 4) {
      errors.addressLine1 = {
        type: "min",
        message: t("address_too_short"),
      }
    }

    if (Object.keys(errors).length > 0) {
      return { values: {}, errors }
    }
    return { values, errors: {} }
  }

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver,
    defaultValues: { ...DEFAULT_VALUES, country: defaultCountry },
  })

  // Cloudflare Turnstile token holder (no-op when not configured).
  const turnstileRef = useRef<TurnstileHandle>(null)

  // Whether the form has been hydrated from sessionStorage yet. Gates the
  // persistence subscription so we never clobber saved data with defaults.
  const [formHydrated, setFormHydrated] = useState(false)

  // Restore an in-progress form from sessionStorage on first mount.
  useEffect(() => {
    if (formHydrated) return
    try {
      // Drop any pre-v2 saved form outright — its field shape predates the
      // current emirate→city model, so restoring it is what used to crash.
      for (const key of LEGACY_FORM_STORAGE_KEYS) sessionStorage.removeItem(key)

      const raw = sessionStorage.getItem(FORM_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<CheckoutFormValues>

        // Drop a country that's no longer offered (e.g. disabled since it was
        // saved) so the form + ship-to currency fall back to the request
        // default rather than a country with no shipping/Select option.
        if (saved.country && !enabledCountries.includes(saved.country)) {
          delete saved.country
        }
        const effectiveCountry = saved.country ?? defaultCountry

        // The emirate sub-region only applies to UAE-style countries; clear a
        // stray emirate for the rest (their `city` is free-text, so keep it).
        // For emirate countries, a saved emirate must still be a current enum
        // key — older bundles could persist one that no longer exists in
        // CITIES_BY_EMIRATE, which indexed to `undefined` and crashed render on
        // `.length`. Drop a stale emirate and its now-orphaned dependent city.
        if (!countryHasEmirates(effectiveCountry)) {
          saved.emirate = ""
        } else if (
          saved.emirate &&
          !(EMIRATES as readonly string[]).includes(saved.emirate)
        ) {
          saved.emirate = ""
          saved.city = ""
        }

        addBreadcrumb(
          `checkout:restore_form country=${saved.country ?? defaultCountry} emirate=${saved.emirate ?? ""} city=${saved.city ? "set" : ""}`,
        )
        reset({ ...DEFAULT_VALUES, country: defaultCountry, ...saved })
        // Keep the global ship-to currency in sync with the restored country.
        if (saved.country) setCountry(saved.country)
      }
    } catch {
      // Corrupt/unavailable storage — fall back to defaults.
    }
    setFormHydrated(true)
  }, [formHydrated, reset, defaultCountry, setCountry, enabledCountries])

  // Persist form values to sessionStorage on every change (after hydration).
  // react-hook-form's `watch` subscription is opaque to the React Compiler
  // (react-hooks/incompatible-library); the component is correct as written.
  // The directive sits on the first `watch` use — the compiler attributes the
  // whole-component skip to it, so the later watch() calls don't need their own.
  useEffect(() => {
    if (!formHydrated) return
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((values) => {
      try {
        sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(values))
      } catch {
        // Storage full / unavailable — persistence is best-effort.
      }
    })
    return () => subscription.unsubscribe()
  }, [formHydrated, watch])

  const emirate = watch("emirate")
  const country = watch("country")
  const phone = watch("phone")
  const hasEmirates = countryHasEmirates(country)
  const marketingConsent = watch("marketingConsent")

  // `phone` is driven by the controlled <PhoneField> (via setValue), but still
  // register it so RHF tracks the field for the resolver + error mapping.
  useEffect(() => {
    register("phone")
  }, [register])

  // Canonical E.164 phone for the current form value (used by OTP/verify).
  // <PhoneField> already emits E.164, so the country arg only matters as a
  // fallback for any restored/national value.
  function canonicalPhone(): string | null {
    const parsed = parsePhoneNumberFromString(
      getValues("phone").trim(),
      getValues("country"),
    )
    return parsed && parsed.isValid() ? parsed.number : null
  }

  // Cart lines in the wire shape the server actions expect.
  function cartPayload() {
    return items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
  }

  // Apply a coupon code — DISPLAY preview only. The server re-validates at order
  // time, so an out-of-date preview can never grant an unearned discount.
  async function applyCoupon(code: string) {
    if (!code.trim()) return
    if (items.length === 0) {
      setCouponError(couponReasonMessage("invalid_request"))
      return
    }
    setCouponApplying(true)
    setCouponError(null)
    try {
      const result = await applyCouponAction({
        code,
        items: cartPayload(),
        country: getValues("country"),
        phone: canonicalPhone() ?? undefined,
      })
      if (result.ok) {
        setCouponCode(result.code)
        setCouponDiscountFils(result.discountFils)
      } else {
        setCouponCode(null)
        setCouponDiscountFils(0)
        setCouponError(couponReasonMessage(result.reason))
      }
    } catch {
      setCouponError(couponReasonMessage("invalid_request"))
    } finally {
      setCouponApplying(false)
    }
  }

  function removeCoupon() {
    setCouponCode(null)
    setCouponDiscountFils(0)
    setCouponError(null)
  }

  const onSubmit = async () => {
    if (items.length === 0) {
      toast.error(t("empty_cart"))
      return
    }
    const phone = canonicalPhone()
    if (!phone) {
      setError("phone", { type: "phone", message: t("invalid_phone") })
      return
    }

    setSubmitting(true)
    try {
      const values = getValues()
      const result = await createOrderAction({
        name: values.name.trim(),
        phone,
        country: values.country,
        emirate: values.emirate || undefined,
        city: values.city.trim(),
        addressLine1: values.addressLine1.trim(),
        addressLine2: values.addressLine2.trim() || undefined,
        notes: values.notes.trim() || undefined,
        email: values.email.trim(),
        marketingConsent: values.marketingConsent,
        couponCode: couponCode ?? undefined,
        locale,
        turnstileToken: turnstileRef.current?.getToken(),
        items: cartPayload(),
      })
      // Turnstile token is single-use — reset after the action.
      turnstileRef.current?.reset()

      if (!result.ok) {
        if (result.error === "out_of_stock") {
          toast.error(t("error_out_of_stock"))
        } else if (result.error === "coupon_unavailable") {
          removeCoupon()
          toast.error(tCoupon("error.coupon_unavailable"))
        } else if (result.error === "verification_failed") {
          toast.error(t("error_verification"))
        } else if (result.field) {
          const formField = serverFieldToFormField(result.field)
          if (formField) {
            setError(formField, {
              type: "server",
              message: t("error_check_details"),
            })
          }
          toast.error(t("error_check_details"))
        } else {
          toast.error(t("error_generic"))
        }
        return
      }

      // Success — clear cart + saved form and navigate to confirmation.
      clear()
      try {
        sessionStorage.removeItem(FORM_STORAGE_KEY)
      } catch {
        // best-effort
      }
      router.push(`/${locale}/orders/${result.orderNumber}`)
    } catch {
      toast.error(t("error_generic"))
    } finally {
      setSubmitting(false)
    }
  }

  // Empty-cart guard (after hydration).
  if (hasHydrated && items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">{t("empty_cart")}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/${locale}/cart`)}
        >
          {t("back_to_cart")}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="order-2 min-w-0 lg:order-1">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
            {/* Contact section */}
            <fieldset className="space-y-4">
              <legend className="font-heading text-lg tracking-wide text-foreground">
                {t("contact_heading")}
              </legend>

              <Field
                id="checkout-name"
                label={t("name")}
                error={errors.name?.message}
              >
                <Input
                  id="checkout-name"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
              </Field>

              <Field
                id="checkout-phone"
                label={t("phone")}
                error={errors.phone?.message}
              >
                <PhoneField
                  id="checkout-phone"
                  value={phone}
                  onChange={(next) =>
                    setValue("phone", next, { shouldValidate: true })
                  }
                  defaultCountry={country}
                  countries={enabledCountries}
                  placeholder={t("phone_placeholder")}
                  locale={locale}
                  invalid={!!errors.phone}
                />
              </Field>

              <Field
                id="checkout-email"
                label={t("email")}
                error={errors.email?.message}
              >
                <Input
                  id="checkout-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </Field>
            </fieldset>

            {/* Delivery section */}
            <fieldset className="space-y-4">
              <legend className="font-heading text-lg tracking-wide text-foreground">
                {t("delivery_heading")}
              </legend>

              <Field
                id="checkout-country"
                label={t("country")}
                error={errors.country?.message}
              >
                <Select
                  value={country || undefined}
                  onValueChange={(value) => {
                    const next = value as CountryCode
                    addBreadcrumb(`checkout:select_country ${value}`)
                    setValue("country", next, { shouldValidate: true })
                    if (!countryHasEmirates(next)) {
                      setValue("emirate", "", { shouldValidate: true })
                      setValue("city", "", { shouldValidate: false })
                    }
                    // Sync the global ship-to currency to the chosen country.
                    setCountry(next)
                  }}
                >
                  <SelectTrigger
                    id="checkout-country"
                    aria-invalid={!!errors.country}
                    className="w-full"
                  >
                    <SelectValue placeholder={t("country_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledCountries.map((value) => (
                      <SelectItem key={value} value={value}>
                        <CountryLabel value={value} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {hasEmirates ? (
                <Field
                  id="checkout-emirate"
                  label={t("emirate")}
                  error={errors.emirate?.message}
                >
                  <Select
                    value={emirate || undefined}
                    onValueChange={(value) => {
                      const cities = CITIES_BY_EMIRATE[value as Emirate]
                      // Radix Select's hidden native <select> emits a spurious
                      // onValueChange with an empty/unknown value during
                      // hydration + form-restore (and with mobile autofill).
                      // Only real emirate keys map to a city list — ignore
                      // anything else, so we neither crash on `cities.length`
                      // nor wipe a restored emirate with the phantom "".
                      if (!cities) {
                        addBreadcrumb(
                          `checkout:select_emirate ignored value=${value || "(empty)"}`,
                        )
                        return
                      }
                      const next = value as Emirate
                      addBreadcrumb(
                        `checkout:select_emirate value=${next} cities=${cities.length}`,
                      )
                      setValue("emirate", next, { shouldValidate: true })
                      setValue("city", cities.length === 1 ? (cities[0]?.en ?? "") : "", { shouldValidate: false })
                    }}
                  >
                    <SelectTrigger
                      id="checkout-emirate"
                      aria-invalid={!!errors.emirate}
                      className="w-full"
                    >
                      <SelectValue placeholder={t("emirate_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {EMIRATES.map((value) => (
                        <SelectItem key={value} value={value}>
                          <EmirateLabel value={value} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              {!(hasEmirates && emirate && (CITIES_BY_EMIRATE[emirate as Emirate] ?? []).length === 1) ? (
              <Field
                id="checkout-city"
                label={t("city")}
                error={errors.city?.message}
              >
                {hasEmirates && emirate ? (
                  <Select
                    value={watch("city") || undefined}
                    onValueChange={(value) => {
                      // Ignore the same phantom empty event Radix can emit on
                      // hydration/autofill, so it can't wipe a restored city.
                      if (!value) return
                      setValue("city", value, { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger
                      id="checkout-city"
                      aria-invalid={!!errors.city}
                      className="w-full"
                    >
                      <SelectValue placeholder={t("city_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(CITIES_BY_EMIRATE[emirate as Emirate] ?? []).map((city) => (
                        <SelectItem key={city.en} value={city.en}>
                          {locale === "ar" ? city.ar : city.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="checkout-city"
                    autoComplete="address-level2"
                    aria-invalid={!!errors.city}
                    {...register("city")}
                  />
                )}
              </Field>
              ) : null}

              <Field
                id="checkout-address1"
                label={t("address_1")}
                error={errors.addressLine1?.message}
              >
                <Input
                  id="checkout-address1"
                  autoComplete="address-line1"
                  aria-invalid={!!errors.addressLine1}
                  {...register("addressLine1")}
                />
              </Field>

              <Field id="checkout-address2" label={t("address_2")}>
                <Input
                  id="checkout-address2"
                  autoComplete="address-line2"
                  {...register("addressLine2")}
                />
              </Field>

              <Field
                id="checkout-notes"
                label={t("notes")}
                hint={t("notes_hint")}
              >
                <Textarea
                  id="checkout-notes"
                  rows={3}
                  maxLength={500}
                  placeholder={t("notes_placeholder")}
                  {...register("notes")}
                />
              </Field>
            </fieldset>

            {/* Marketing opt-in (WhatsApp offers / new arrivals). Unchecked by default. */}
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={marketingConsent}
                onCheckedChange={(value) =>
                  setValue("marketingConsent", value === true)
                }
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                {t("marketing_consent")}
              </span>
            </label>

            {/* Payment method. COD is the only live option; online payment is
                shown as "coming soon" so customers know it's planned. Display
                only — every order is COD today, so there's nothing to submit. */}
            <fieldset className="space-y-3">
              <legend className="font-heading text-lg tracking-wide text-foreground">
                {t("payment_heading")}
              </legend>
              <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 p-4">
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"
                >
                  <span className="size-2.5 rounded-full bg-primary" />
                </span>
                <span className="flex-1 font-medium text-foreground">
                  {t("payment_cod")}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-4 opacity-60">
                <span
                  aria-hidden="true"
                  className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/40"
                />
                <span className="flex-1 text-muted-foreground">
                  {t("payment_online")}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t("payment_online_soon")}
                </span>
              </div>
            </fieldset>

            {/* Invisible/managed bot challenge. Renders nothing when Turnstile
                is not configured. */}
            <TurnstileWidget ref={turnstileRef} />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t("placing_order")}
                </>
              ) : (
                t("place_order")
              )}
            </Button>
          </form>
      </div>

      <div className="order-1 min-w-0 lg:order-2">
        <div className="lg:sticky lg:top-20">
          <OrderSummary
            shippingConfig={shippingConfig}
            country={country}
            coupon={{
              code: couponCode,
              discountFils: couponDiscountFils,
              applying: couponApplying,
              error: couponError,
              onApply: applyCoupon,
              onRemove: removeCoupon,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  )
}

function EmirateLabel({ value }: { value: Emirate }) {
  const t = useTranslations("emirate")
  return <>{t(value)}</>
}

function CountryLabel({ value }: { value: CountryCode }) {
  const t = useTranslations("country")
  return <>{t(value)}</>
}
