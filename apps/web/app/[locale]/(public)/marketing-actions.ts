"use server"

import { parsePhoneNumberFromString } from "libphonenumber-js"
import { z } from "zod"

import { CouponType } from "@workspace/db"

import { reportError } from "@/lib/errors"
import { createCoupon, generateUniqueCode } from "@/lib/repos/coupons.repo"
import {
  claimWelcomeCouponCode,
  subscribeMarketing,
} from "@/lib/repos/customers.repo"

/** Strict E.164 phone — mirrors the checkout schema's transform. */
const phoneE164 = z.string().transform((raw, ctx) => {
  const parsed = parsePhoneNumberFromString(raw.trim())
  if (!parsed || !parsed.isValid()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid phone number",
    })
    return z.NEVER
  }
  return parsed.number
})

const subscribeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneE164,
  locale: z.union([z.literal("ar"), z.literal("en")]),
})

/** Welcome-coupon defaults issued to a fresh WhatsApp subscriber. */
const WELCOME_DISCOUNT_PERCENT = 10

/**
 * Capture a WhatsApp marketing opt-in from the home section / popup: record the
 * customer with consent (idempotent on phone), mint a single-use first-order
 * welcome coupon, and return its code to display. Errors never throw across the
 * boundary — they come back as `{ ok: false }`.
 */
export async function subscribeWhatsappAction(input: {
  name: string
  phone: string
  locale: string
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const parsed = subscribeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "invalid_request" }
  }

  try {
    const customer = await subscribeMarketing({
      phone: parsed.data.phone,
      name: parsed.data.name,
      locale: parsed.data.locale,
    })

    // One welcome coupon per phone: if this subscriber already has one, block
    // the re-signup and surface a clear error instead of silently re-issuing.
    if (customer.welcomeCouponCode) {
      return { ok: false, error: "already_subscribed" }
    }

    // Claim a code atomically before creating the coupon, so a concurrent
    // double-submit can't produce two coupons for the same phone.
    const candidate = await generateUniqueCode("WELCOME")
    const { code, reserved } = await claimWelcomeCouponCode(
      customer.id,
      candidate,
    )
    if (reserved) {
      await createCoupon({
        code,
        type: CouponType.PERCENT,
        value: WELCOME_DISCOUNT_PERCENT,
        minSubtotalFils: 0,
        maxDiscountFils: null,
        firstOrderOnly: true,
        maxRedemptions: null,
        perCustomerLimit: 1,
        startsAt: null,
        expiresAt: null,
        isActive: true,
      })
    }

    return { ok: true, code }
  } catch (err) {
    reportError("subscribeWhatsappAction", err)
    return { ok: false, error: "something_went_wrong" }
  }
}
