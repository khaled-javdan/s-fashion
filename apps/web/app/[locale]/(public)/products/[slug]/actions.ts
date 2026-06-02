"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { reportError } from "@/lib/errors"
import {
  createCustomerReview,
  isActiveProduct,
} from "@/lib/repos/reviews.repo"
import {
  customerReviewSchema,
  type CustomerReviewInput,
} from "@/lib/schemas/review.schema"
import { verifyTurnstile } from "@/lib/services/turnstile"

/**
 * Public result envelope. The optional `code` lets the client map a failure to
 * a localized message; expected errors are returned (never thrown).
 */
export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; code: SubmitReviewErrorCode }

export type SubmitReviewErrorCode =
  | "bot"
  | "invalid_request"
  | "product_not_found"
  | "generic"

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

/**
 * Submit a customer review for a product (the PDP "Write a review" form).
 *
 * Bot-gated via Turnstile (skipped when not configured), validated, and only
 * accepted for active products. The review is created hidden
 * (`isCustomerSubmitted`, `isVisible: false`) so it never goes live until an
 * admin approves it — nothing here is trusted to set visibility/featured.
 * Revalidates the PDP + admin queue so the new pending count shows immediately.
 */
export async function submitProductReviewAction(
  input: CustomerReviewInput,
): Promise<SubmitReviewResult> {
  const parsed = customerReviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, code: "invalid_request" }

  const data = parsed.data

  // Bot protection — mirrors the checkout OTP flow. Fails open when Turnstile
  // is unreachable, and is skipped entirely when not configured (local dev).
  const ip = await getClientIp()
  const human = await verifyTurnstile(data.turnstileToken, ip)
  if (!human) return { ok: false, code: "bot" }

  try {
    if (!(await isActiveProduct(data.productId))) {
      return { ok: false, code: "product_not_found" }
    }

    await createCustomerReview({
      productId: data.productId,
      rating: data.rating,
      authorName: data.authorName,
      authorEmail: data.authorEmail,
      body: data.body,
    })

    // Refresh the admin moderation queue so the new pending review shows up.
    // (The public PDP list is unchanged until approval, so no need to bust it.)
    revalidatePath("/[locale]/admin/(authed)/reviews", "page")

    return { ok: true }
  } catch (err) {
    reportError("submitProductReviewAction", err)
    return { ok: false, code: "generic" }
  }
}
