"use server"

import { headers } from "next/headers"
import { parsePhoneNumberFromString } from "libphonenumber-js"
import { z } from "zod"

import { Emirate, Size, prisma } from "@workspace/db"

import { reportError } from "@/lib/errors"
import { parseCurrencyConfig, effectiveRate } from "@/lib/currency-config"
import { COUNTRY_CODES, currencyForCountry } from "@/lib/geo"
import type { Locale } from "@/lib/locale"
import {
  validateCoupon,
  type CouponInvalidReason,
} from "@/lib/repos/coupons.repo"
import {
  createOrder,
  CouponExhaustedError,
  InsufficientStockError,
} from "@/lib/repos/orders.repo"
import {
  enabledCountries,
  parseShippingConfig,
  resolveShipping,
} from "@/lib/shipping-config"
import { getSetting } from "@/lib/repos/settings.repo"
import {
  ABSOLUTE_MAX_QTY_PER_VARIANT,
  DEFAULT_MAX_QTY_PER_VARIANT,
} from "@/lib/order-limits"
import {
  orderCreateSchema,
  type OrderCreateInput,
} from "@/lib/schemas/order.schema"
import { dispatchOrderNotifications } from "@/lib/services/order-notifications"
import { verifyTurnstile } from "@/lib/services/turnstile"

/** Public field handle used for targeted client-side error mapping. */
type OrderInput = OrderCreateInput

// ─── Schemas ──────────────────────────────────────────────────────────────

/** Cart line shape for cart pre-check and order creation. */
const cartItemSchema = z.object({
  variantId: z.string().min(1),
  // Absolute ceiling only — the configured per-variant cap is enforced against
  // the live `order.max_qty_per_variant` setting in resolveAndValidateItems.
  quantity: z.number().int().min(1).max(ABSOLUTE_MAX_QTY_PER_VARIANT),
})

const createOrderSchema = orderCreateSchema
  .omit({ items: true })
  .extend({
    // Cloudflare Turnstile token (present only when Turnstile is configured).
    turnstileToken: z.string().optional(),
    items: z.array(cartItemSchema).min(1),
  })

// Display-only coupon preview: re-resolve items server-side, then validate.
const applyCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  items: z.array(cartItemSchema).min(1),
  country: z.enum(COUNTRY_CODES),
  phone: z.string().optional(),
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

/** A cart line resolved against the DB, carrying the snapshots createOrder needs. */
type ResolvedItem = {
  variantId: string
  quantity: number
  productNameAr: string
  productNameEn: string
  colorNameAr: string | null
  colorNameEn: string | null
  size: Size
  unitPriceFils: number
  unitCostFils: number
  /** Product shipping weight in grams (0 when unset) — drives weight pricing. */
  weightGrams: number
}

/**
 * Re-load each cart line against the DB and validate it: product active, in
 * stock, and within the admin-configured per-variant quantity cap. Returns the
 * fully-snapshotted items for order creation, or a tagged error.
 *
 * Called by createOrderAction before committing the order.
 */
async function resolveAndValidateItems(
  items: { variantId: string; quantity: number }[],
): Promise<
  | { ok: true; items: ResolvedItem[] }
  | { ok: false; error: "out_of_stock" | "Invalid request" }
> {
  const maxQtyPerVariant =
    (await getSetting("order.max_qty_per_variant")) ??
    DEFAULT_MAX_QTY_PER_VARIANT

  const resolved: ResolvedItem[] = []
  for (const line of items) {
    if (line.quantity > maxQtyPerVariant) {
      return { ok: false, error: "Invalid request" }
    }
    const variant = await prisma.productVariant.findUnique({
      where: { id: line.variantId },
      include: { product: true },
    })
    if (
      !variant ||
      variant.isArchived ||
      !variant.product.isActive ||
      variant.stock < line.quantity
    ) {
      return { ok: false, error: "out_of_stock" }
    }
    resolved.push({
      variantId: variant.id,
      quantity: line.quantity,
      productNameAr: variant.product.nameAr,
      productNameEn: variant.product.nameEn,
      colorNameAr: variant.colorNameAr,
      colorNameEn: variant.colorNameEn,
      size: variant.size,
      unitPriceFils: variant.product.priceFils,
      unitCostFils: variant.product.costPriceFils ?? 0,
      weightGrams: variant.product.weightGrams ?? 0,
    })
  }
  return { ok: true, items: resolved }
}

// ─── applyCouponAction ──────────────────────────────────────────────────────

/**
 * Preview a coupon for the cart — DISPLAY ONLY. Re-resolves the cart against the
 * DB to get the authoritative subtotal, then validates the coupon (optionally
 * with the customer's phone for first-order / per-customer checks). The order
 * action re-validates authoritatively at creation time, so this never grants a
 * discount on its own.
 */
export async function applyCouponAction(input: {
  code: string
  items: { variantId: string; quantity: number }[]
  country: string
  phone?: string
}): Promise<
  | { ok: true; code: string; discountFils: number }
  | { ok: false; reason: CouponInvalidReason | "invalid_request" }
> {
  const parsed = applyCouponSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, reason: "invalid_request" }
  }

  const resolved = await resolveAndValidateItems(parsed.data.items)
  if (!resolved.ok) {
    return { ok: false, reason: "invalid_request" }
  }

  const subtotalFils = resolved.items.reduce(
    (sum, item) => sum + item.unitPriceFils * item.quantity,
    0,
  )

  // Phone is optional here — only canonicalise it when present (first-order +
  // per-customer rules need it; otherwise validateCoupon rejects gated coupons).
  const phone = parsed.data.phone ? toE164(parsed.data.phone) : null

  const result = await validateCoupon({
    code: parsed.data.code,
    subtotalFils,
    phone,
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }
  return { ok: true, code: result.code, discountFils: result.discountFils }
}

// ─── createOrderAction ──────────────────────────────────────────────────────

/**
 * Validate the cart and order details, compute pricing server-side, create the
 * order (stock decrement happens in the repo transaction), then fire-and-forget
 * the Telegram + Resend notifications.
 */
export async function createOrderAction(input: {
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
  couponCode?: string
  turnstileToken?: string
  items: { variantId: string; quantity: number }[]
}): Promise<
  | { ok: true; orderNumber: string }
  | { ok: false; error: string; field?: keyof OrderInput }
> {
  // 1. Validate the full payload. `orderCreateSchema` expects `customerName`,
  //    so adapt the client field name (`name`) into the schema's shape.
  const parsed = createOrderSchema.safeParse({
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
    couponCode: input.couponCode,
    turnstileToken: input.turnstileToken,
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

  // 2. Bot challenge (Cloudflare Turnstile). No-op when not configured.
  const ip = await getClientIp()
  const human = await verifyTurnstile(data.turnstileToken, ip)
  if (!human) {
    return { ok: false, error: "verification_failed" }
  }

  // 3. Re-load + validate each cart line against the DB (active, in stock,
  //    within the admin-configured per-variant cap).
  const resolved = await resolveAndValidateItems(data.items)
  if (!resolved.ok) {
    return { ok: false, error: resolved.error }
  }
  const resolvedItems = resolved.items

  // 4. Compute pricing server-side. Never trust client totals.
  const subtotalFils = resolvedItems.reduce(
    (sum, item) => sum + item.unitPriceFils * item.quantity,
    0,
  )

  const shippingConfig = parseShippingConfig(
    await getSetting("shipping.countries"),
  )

  // Reject destinations we don't currently ship to. The client only renders
  // enabled countries, but a stale bundle / crafted request must not slip a
  // disabled country past server validation (resolveShipping would otherwise
  // silently fall back to the default country's rate).
  if (!enabledCountries(shippingConfig).includes(data.country)) {
    return { ok: false, error: "Invalid request", field: "country" }
  }

  // Total parcel weight drives the per-kg surcharge. Computed from the DB
  // snapshots, never the client. Free-shipping threshold is intentionally
  // evaluated against the PRE-discount subtotal — a coupon shouldn't push an
  // order below the free-ship line.
  const totalWeightGrams = resolvedItems.reduce(
    (sum, item) => sum + item.weightGrams * item.quantity,
    0,
  )
  const { shippingFils } = resolveShipping(
    shippingConfig,
    data.country,
    subtotalFils,
    totalWeightGrams,
  )

  // Re-validate the coupon authoritatively against the server subtotal + the
  // verified phone. If it's no longer valid (expired, cap hit, etc.) we proceed
  // gracefully with no discount rather than failing the order outright.
  let discountFils = 0
  let couponCode: string | null = null
  let couponId: string | null = null
  if (data.couponCode && data.couponCode.trim()) {
    const couponResult = await validateCoupon({
      code: data.couponCode,
      subtotalFils,
      phone,
    })
    if (couponResult.ok) {
      discountFils = couponResult.discountFils
      couponCode = couponResult.code
      couponId = couponResult.couponId
    }
  }

  const totalFils = subtotalFils - discountFils + shippingFils

  // Currency snapshot (display only — money columns stay in base AED fils).
  const currencyConfig = parseCurrencyConfig(
    await getSetting("currency.config"),
  )
  const displayCurrency = currencyForCountry(data.country)
  const fxRate = effectiveRate(currencyConfig, displayCurrency)

  // 5. Create the order. Stock decrement, customer upsert + link, order number,
  //    and the NEW status all happen in one transaction.
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
        discountFils,
        couponCode,
        couponId,
        displayCurrency,
        fxRate,
      },
      resolvedItems,
    )
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "out_of_stock" }
    }
    // The coupon's global cap was hit between our re-validate and the in-tx
    // redemption guard. Surface a coupon-specific error so the client can clear
    // it and let the customer retry without the (now-exhausted) coupon.
    if (err instanceof CouponExhaustedError) {
      return { ok: false, error: "coupon_unavailable" }
    }
    reportError("checkout.createOrderAction.createOrder", err, {
      country: data.country,
    })
    return { ok: false, error: "Something went wrong" }
  }

  // 6. Fire-and-forget side effects. The dispatcher rebuilds payloads from the
  //    persisted order, stamps each channel on success, and is idempotent — a
  //    retry cron re-runs it for any order still missing a stamp, so a transient
  //    Telegram/email failure here is recovered rather than silently lost.
  void dispatchOrderNotifications(created.id).catch((err) =>
    reportError("checkout.dispatchOrderNotifications", err, {
      orderId: created.id,
    }),
  )

  // 7. Done.
  return { ok: true, orderNumber: created.orderNumber }
}
