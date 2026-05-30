"use client"

import { useState } from "react"
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
import {
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
  const locale = useLocale() as Locale
  const router = useRouter()
  const { setCountry } = useCurrency()

  const items = useCartStore(selectItems)
  const hasHydrated = useCartStore(selectHasHydrated)
  const clear = useCartStore((s) => s.clear)

  const [step, setStep] = useState<"form" | "otp">("form")
  const [submitting, setSubmitting] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)

  // Client-side validation resolver. Mirrors the server schema's rules and
  // returns translated messages.
  const resolver: Resolver<CheckoutFormValues> = async (values) => {
    const errors: Record<string, { type: string; message: string }> = {}

    if (values.name.trim().length < 2) {
      errors.name = { type: "min", message: t("name_too_short") }
    }
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
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver,
    defaultValues: { ...DEFAULT_VALUES, country: defaultCountry },
  })

  // react-hook-form's `watch` subscription is opaque to the React Compiler
  // (react-hooks/incompatible-library); the component is correct as written.
  // eslint-disable-next-line react-hooks/incompatible-library
  const emirate = watch("emirate")
  const country = watch("country")
  const hasEmirates = countryHasEmirates(country)
  const marketingConsent = watch("marketingConsent")

  // Canonical E.164 phone for the current form value (used by OTP/verify).
  function canonicalPhone(): string | null {
    const parsed = parsePhoneNumberFromString(
      getValues("phone").trim(),
      getValues("country"),
    )
    return parsed && parsed.isValid() ? parsed.number : null
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
      const result = await sendOtpAction({ phone, locale })
      if (!result.ok) {
        toast.error(
          result.error === "Too many attempts"
            ? t("error_too_many")
            : t("error_generic"),
        )
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
        locale,
        otpCode: code,
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      })

      if (!result.ok) {
        if (result.error === "Invalid code") {
          setOtpError(t("error_invalid_code"))
        } else if (result.error === "out_of_stock") {
          toast.error(t("error_out_of_stock"))
          setStep("form")
        } else {
          setOtpError(t("error_generic"))
        }
        return
      }

      // Success — clear cart and navigate to confirmation.
      clear()
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
    const result = await sendOtpAction({ phone, locale })
    if (!result.ok) {
      toast.error(
        result.error === "Too many attempts"
          ? t("error_too_many")
          : t("error_generic"),
      )
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
      <div className="order-2 lg:order-1">
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
                <Input
                  id="checkout-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+9715XXXXXXXX"
                  dir="ltr"
                  aria-invalid={!!errors.phone}
                  {...register("phone")}
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
                    onValueChange={(value) =>
                      setValue("emirate", value as Emirate, {
                        shouldValidate: true,
                      })
                    }
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

              <Field
                id="checkout-city"
                label={t("city")}
                error={errors.city?.message}
              >
                <Input
                  id="checkout-city"
                  autoComplete="address-level2"
                  aria-invalid={!!errors.city}
                  {...register("city")}
                />
              </Field>

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

              <Field id="checkout-notes" label={t("notes")}>
                <Textarea
                  id="checkout-notes"
                  rows={3}
                  maxLength={500}
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

      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-20">
          <OrderSummary shippingConfig={shippingConfig} country={country} />
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
