"use server"

import { headers } from "next/headers"
import { parsePhoneNumberFromString } from "libphonenumber-js"
import { z } from "zod"

import { Emirate, prisma } from "@workspace/db"

import { parseCurrencyConfig, effectiveRate } from "@/lib/currency-config"
import { currencyForCountry } from "@/lib/geo"
import type { Locale } from "@/lib/locale"
import {
  createOrder,
  markPhoneVerified,
  InsufficientStockError,
} from "@/lib/repos/orders.repo"
import { parseShippingConfig, resolveShipping } from "@/lib/shipping-config"
import {
  countAttemptsForIp,
  countAttemptsForPhone,
  recordAttempt,
} from "@/lib/repos/otp-attempts.repo"
import { getSetting } from "@/lib/repos/settings.repo"
import {
  orderCreateSchema,
  type OrderCreateInput,
} from "@/lib/schemas/order.schema"
import { sendOrderConfirmationEmail } from "@/lib/services/resend"
import { sendOrderNotification } from "@/lib/services/telegram"
import { checkOtp, sendOtp } from "@/lib/services/twilio"

/** Public field handle used for targeted client-side error mapping. */
type OrderInput = OrderCreateInput

// ─── Rate-limit policy ──────────────────────────────────────────────────────
const PHONE_LIMIT = 5 // attempts per phone …
const IP_LIMIT = 20 // … per IP …
const WINDOW_MINUTES = 60 // … per rolling hour.

// ─── Schemas ──────────────────────────────────────────────────────────────

const sendOtpSchema = z.object({
  phone: z.string().min(1),
  locale: z.union([z.literal("ar"), z.literal("en")]),
})

const verifyAndCreateSchema = orderCreateSchema
  .omit({ items: true })
  .extend({
    otpCode: z.string().regex(/^\d{6}$/, "invalid code"),
    items: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.number().int().min(1).max(2),
        }),
      )
      .min(1),
  })

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Best-effort client IP from the proxy chain. `x-forwarded-for` first. */
async function getClientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get("x-forwarded-for")
  if (fwd) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  return h.get("x-real-ip") ?? "unknown"
}

/** Validate + canonicalise a phone number to E.164, or null if invalid. */
function toE164(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw.trim())
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

function absoluteAdminOrderUrl(orderId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  return `${base}/admin/orders/${orderId}`
}

// ─── sendOtpAction ────────────────────────────────────────────────────────

/**
 * Validate the phone, enforce per-phone and per-IP hourly rate limits, then
 * send an SMS OTP via Twilio Verify. Records the attempt on success.
 */
export async function sendOtpAction(input: {
  phone: string
  locale: Locale
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = sendOtpSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request" }
  }

  const phone = toE164(parsed.data.phone)
  if (!phone) {
    return { ok: false, error: "Invalid phone number" }
  }

  const ip = await getClientIp()

  try {
    const [phoneCount, ipCount] = await Promise.all([
      countAttemptsForPhone(phone, WINDOW_MINUTES),
      countAttemptsForIp(ip, WINDOW_MINUTES),
    ])
    if (phoneCount >= PHONE_LIMIT || ipCount >= IP_LIMIT) {
      return { ok: false, error: "Too many attempts" }
    }
  } catch (err) {
    console.error("[checkout.sendOtpAction] rate-limit check failed", err)
    return { ok: false, error: "Something went wrong" }
  }

  const result = await sendOtp(phone)
  if (!result.ok) {
    // Record the failed attempt so abusive senders still accrue toward limits.
    try {
      await recordAttempt(phone, ip, false)
    } catch (err) {
      console.error("[checkout.sendOtpAction] recordAttempt(failure) failed", err)
    }
    return { ok: false, error: "Could not send code. Please try again." }
  }

  try {
    await recordAttempt(phone, ip, true)
  } catch (err) {
    console.error("[checkout.sendOtpAction] recordAttempt(success) failed", err)
  }

  return { ok: true }
}

// ─── verifyOtpAndCreateOrderAction ──────────────────────────────────────────

/**
 * Verify the OTP, re-validate the cart against the DB, compute pricing
 * server-side, create the order (stock decrement happens in the repo
 * transaction), then fire-and-forget the Telegram + Resend notifications.
 */
export async function verifyOtpAndCreateOrderAction(input: {
  name: string
  phone: string
  country: string
  emirate?: Emirate
  city: string
  addressLine1: string
  addressLine2?: string
  notes?: string
  email?: string
  locale: Locale
  marketingConsent?: boolean
  otpCode: string
  items: { variantId: string; quantity: number }[]
}): Promise<
  | { ok: true; orderNumber: string }
  | { ok: false; error: string; field?: keyof OrderInput }
> {
  // 1. Validate the full payload. `orderCreateSchema` expects `customerName`,
  //    so adapt the client field name (`name`) into the schema's shape.
  const parsed = verifyAndCreateSchema.safeParse({
    customerName: input.name,
    phone: input.phone,
    email: input.email,
    country: input.country,
    emirate: input.emirate,
    city: input.city,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    notes: input.notes,
    locale: input.locale,
    marketingConsent: input.marketingConsent ?? false,
    otpCode: input.otpCode,
    items: input.items,
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path[0]
    const field =
      path === "customerName" ? "customerName" : (path as keyof OrderInput | undefined)
    return {
      ok: false,
      error: issue?.message ?? "Invalid request",
      field,
    }
  }

  const data = parsed.data
  const phone = data.phone // already canonical E.164 from the schema transform

  // Emirate is required for UAE destinations (optional in the schema so it can
  // stay a plain ZodObject; the conditional rule is enforced here + client-side).
  if (data.country === "AE" && !data.emirate) {
    return { ok: false, error: "Invalid request", field: "emirate" }
  }

  // 2. Verify the OTP.
  const check = await checkOtp(phone, data.otpCode)
  if (!check.ok) {
    return { ok: false, error: "Invalid code" }
  }

  // 3. Re-load each variant; reject inactive / out-of-stock / over-quantity.
  const resolvedItems = []
  for (const line of data.items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: line.variantId },
      include: { product: true },
    })
    if (!variant || !variant.product.isActive) {
      return { ok: false, error: "out_of_stock" }
    }
    if (variant.stock < line.quantity) {
      return { ok: false, error: "out_of_stock" }
    }
    resolvedItems.push({
      variantId: variant.id,
      quantity: line.quantity,
      productNameAr: variant.product.nameAr,
      productNameEn: variant.product.nameEn,
      colorNameAr: variant.colorNameAr,
      colorNameEn: variant.colorNameEn,
      size: variant.size,
      unitPriceFils: variant.product.priceFils,
      unitCostFils: variant.product.costPriceFils ?? 0,
    })
  }

  // 4. Compute pricing server-side. Never trust client totals.
  const subtotalFils = resolvedItems.reduce(
    (sum, item) => sum + item.unitPriceFils * item.quantity,
    0,
  )

  const shippingConfig = parseShippingConfig(
    await getSetting("shipping.countries"),
  )
  const { shippingFils } = resolveShipping(
    shippingConfig,
    data.country,
    subtotalFils,
  )
  const totalFils = subtotalFils + shippingFils

  // Currency snapshot (display only — money columns stay in base AED fils).
  const currencyConfig = parseCurrencyConfig(
    await getSetting("currency.config"),
  )
  const displayCurrency = currencyForCountry(data.country)
  const fxRate = effectiveRate(currencyConfig, displayCurrency)

  // 5. Create the order (stock decrement + order number in one transaction).
  let created: { id: string; orderNumber: string }
  try {
    created = await createOrder(
      {
        customerName: data.customerName,
        phone,
        email: data.email,
        country: data.country,
        emirate: data.emirate,
        city: data.city,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        notes: data.notes,
        locale: data.locale,
        marketingConsent: data.marketingConsent,
        subtotalFils,
        shippingFils,
        totalFils,
        displayCurrency,
        fxRate,
      },
      resolvedItems,
    )
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "out_of_stock" }
    }
    console.error("[checkout.verifyOtpAndCreateOrderAction] createOrder failed", err)
    return { ok: false, error: "Something went wrong" }
  }

  // 5b. OTP already passed, so move the order out of PENDING_VERIFICATION
  //     into NEW (sets phoneVerified + appends an event). Non-fatal on error.
  try {
    await markPhoneVerified(created.id)
  } catch (err) {
    console.error("[checkout.verifyOtpAndCreateOrderAction] markPhoneVerified failed", err)
  }

  // 6. Fire-and-forget side effects. Never block (or fail) the response.
  void sendOrderNotification({
    orderNumber: created.orderNumber,
    customerName: data.customerName,
    phone,
    country: data.country,
    emirate: data.emirate ?? null,
    totalFils,
    itemCount: resolvedItems.reduce((sum, i) => sum + i.quantity, 0),
    adminUrl: absoluteAdminOrderUrl(created.id),
  }).catch((err) =>
    console.error("[checkout] telegram notification failed", err),
  )

  if (data.email) {
    void sendOrderConfirmationEmail({
      to: data.email,
      locale: data.locale,
      order: {
        orderNumber: created.orderNumber,
        customerName: data.customerName,
        items: resolvedItems.map((i) => ({
          productName: data.locale === "ar" ? i.productNameAr : i.productNameEn,
          variantLabel: [
            data.locale === "ar" ? i.colorNameAr : i.colorNameEn,
            i.size,
          ]
            .filter(Boolean)
            .join(" · "),
          quantity: i.quantity,
          unitPriceFils: i.unitPriceFils,
        })),
        subtotalFils,
        shippingFils,
        totalFils,
      },
    }).catch((err) =>
      console.error("[checkout] confirmation email failed", err),
    )
  }

  // 7. Done.
  return { ok: true, orderNumber: created.orderNumber }
}
