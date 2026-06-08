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
import { OtpStep } from "@/app/[locale]/(public)/checkout/otp-step"
import { PhoneField } from "@/components/forms/phone-field"
import {
  TurnstileWidget,
  type TurnstileHandle,
} from "@/app/[locale]/(public)/checkout/turnstile-widget"
import {
  applyCouponAction,
  sendOtpAction,
  verifyOtpAndCreateOrderAction,
} from "@/app/[locale]/(public)/checkout/actions"
import { useCurrency } from "@/components/providers/currency-provider"
import {
  selectItems,
  selectHasHydrated,
  useCartStore,
} from "@/lib/cart-store"
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
const FORM_STORAGE_KEY = "s-fashion-checkout-form"

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
 *  1. "Place order" → `sendOtpAction`. On success, swap to `OtpStep`.
 *  2. OTP complete → `verifyOtpAndCreateOrderAction`. On success, clear the
 *     cart and navigate to the confirmation page.
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
  const clear = useCartStore((s) => s.clear)

  const [step, setStep] = useState<"form" | "otp">("form")
  const [submitting, setSubmitting] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)

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
    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
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
      const raw = sessionStorage.getItem(FORM_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<CheckoutFormValues>
        reset({ ...DEFAULT_VALUES, country: defaultCountry, ...saved })
        // Keep the global ship-to currency in sync with the restored country.
        if (saved.country) setCountry(saved.country)
      }
    } catch {
      // Corrupt/unavailable storage — fall back to defaults.
    }
    setFormHydrated(true)
  }, [formHydrated, reset, defaultCountry, setCountry])

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

  // Map a send-OTP error code to a toast. The cart pre-check can surface
  // out-of-stock here (before any SMS is spent), so handle it like the form step.
  function reportSendError(error: string) {
    if (error === "Too many attempts") {
      toast.error(t("error_too_many"))
    } else if (error === "out_of_stock") {
      toast.error(t("error_out_of_stock"))
    } else if (error === "verification_failed") {
      toast.error(t("error_verification"))
    } else {
      toast.error(t("error_generic"))
    }
  }

  // Step 1 — send OTP.
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
    setOtpError(null)
    try {
      const result = await sendOtpAction({
        phone,
        locale,
        items: cartPayload(),
        turnstileToken: turnstileRef.current?.getToken(),
      })
      // The Turnstile token is single-use — drop it so a resend re-challenges.
      turnstileRef.current?.reset()
      if (!result.ok) {
        reportSendError(result.error)
        return
      }
      setStep("otp")
    } catch {
      toast.error(t("error_generic"))
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2 — verify OTP + create order.
  async function handleVerify(code: string) {
    const phone = canonicalPhone()
    if (!phone) {
      setStep("form")
      return
    }
    if (items.length === 0) {
      toast.error(t("empty_cart"))
      return
    }

    setSubmitting(true)
    setOtpError(null)
    try {
      const values = getValues()
      const result = await verifyOtpAndCreateOrderAction({
        name: values.name.trim(),
        phone,
        country: values.country,
        emirate: values.emirate || undefined,
        city: values.city.trim(),
        addressLine1: values.addressLine1.trim(),
        addressLine2: values.addressLine2.trim() || undefined,
        notes: values.notes.trim() || undefined,
        email: values.email.trim() || undefined,
        marketingConsent: values.marketingConsent,
        couponCode: couponCode ?? undefined,
        locale,
        otpCode: code,
        items: cartPayload(),
      })

      if (!result.ok) {
        if (result.error === "Invalid code") {
          setOtpError(t("error_invalid_code"))
        } else if (result.error === "out_of_stock") {
          toast.error(t("error_out_of_stock"))
          setStep("form")
        } else if (result.error === "coupon_unavailable") {
          // The coupon's cap was hit between preview + creation. Clear it and
          // return to the form so the customer can re-place without it.
          removeCoupon()
          toast.error(tCoupon("error.coupon_unavailable"))
          setStep("form")
        } else if (result.error === "verification_failed") {
          toast.error(t("error_verification"))
          setStep("form")
        } else if (result.field) {
          // A field-level problem slipped past client validation (e.g. a stale
          // bundle or an edge the resolver missed). Return to the form and
          // highlight the offending field so it's actionable, not a dead end.
          const formField = serverFieldToFormField(result.field)
          setStep("form")
          if (formField) {
            setError(formField, {
              type: "server",
              message: t("error_check_details"),
            })
          }
          toast.error(t("error_check_details"))
        } else {
          setOtpError(t("error_generic"))
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
      setOtpError(t("error_generic"))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    const phone = canonicalPhone()
    if (!phone) return
    const result = await sendOtpAction({
      phone,
      locale,
      items: cartPayload(),
      turnstileToken: turnstileRef.current?.getToken(),
    })
    // Single-use token — reset so a subsequent resend re-challenges.
    turnstileRef.current?.reset()
    if (!result.ok) {
      reportSendError(result.error)
    }
  }

  // Empty-cart guard (after hydration).
  if (hasHydrated && items.length === 0 && step === "form") {
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
        {step === "form" ? (
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
                hint={t("phone_hint")}
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
                    setValue("country", next, { shouldValidate: true })
                    if (!countryHasEmirates(next)) {
                      setValue("emirate", "", { shouldValidate: true })
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
                      const next = value as Emirate
                      setValue("emirate", next, { shouldValidate: true })
                      const cities = CITIES_BY_EMIRATE[next]
                      setValue("city", cities.length === 1 ? cities[0].en : "", { shouldValidate: false })
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

              {!(hasEmirates && emirate && CITIES_BY_EMIRATE[emirate as Emirate].length === 1) ? (
              <Field
                id="checkout-city"
                label={t("city")}
                error={errors.city?.message}
              >
                {hasEmirates && emirate ? (
                  <Select
                    value={watch("city") || undefined}
                    onValueChange={(value) =>
                      setValue("city", value, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger
                      id="checkout-city"
                      aria-invalid={!!errors.city}
                      className="w-full"
                    >
                      <SelectValue placeholder={t("city_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {CITIES_BY_EMIRATE[emirate as Emirate].map((city) => (
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
        ) : (
          <OtpStep
            phone={canonicalPhone() ?? getValues("phone")}
            submitting={submitting}
            error={otpError}
            onComplete={handleVerify}
            onResend={handleResend}
            onEdit={() => {
              setStep("form")
              setOtpError(null)
            }}
          />
        )}
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
