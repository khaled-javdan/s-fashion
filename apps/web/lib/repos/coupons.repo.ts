import { prisma, CouponType, Prisma } from "@workspace/db";
import type { Coupon } from "@workspace/db";

import { SALES_STATUSES } from "@/lib/repos/orders.repo";

/**
 * Minimal Prisma client surface shared by the live client and a transaction —
 * just the models coupon validation/redemption touch. Accepting this lets the
 * same helpers run standalone (display-only validation) or inside createOrder's
 * atomic transaction (authoritative re-check + redemption).
 */
type Db = Pick<typeof prisma, "coupon" | "couponRedemption" | "order">;
/** Subset that also supports `$executeRaw` — only the redemption helper needs it. */
type TxDb = Db & Pick<Prisma.TransactionClient, "$executeRaw">;

/** Why a coupon failed validation — surfaced to the client for a friendly message. */
export type CouponInvalidReason =
  | "not_found"
  | "inactive"
  | "expired"
  | "not_started"
  | "below_min"
  | "first_order_only"
  | "max_redemptions"
  | "per_customer_limit"
  // A phone-gated coupon (first-order / per-customer) was checked without a
  // phone — the shopper just hasn't entered it yet. Distinct from the gating
  // reasons so the UI can ask for the number instead of wrongly claiming the
  // coupon doesn't apply to them.
  | "phone_required";

export type ValidateCouponInput = {
  code: string;
  /** Authoritative, server-resolved subtotal in fils (pre-discount). */
  subtotalFils: number;
  /** Canonical E.164 phone — required for first-order + per-customer checks. */
  phone?: string | null;
};

export type ValidateCouponResult =
  | { ok: true; couponId: string; code: string; discountFils: number }
  | { ok: false; reason: CouponInvalidReason };

/** Normalize a coupon code to its stored form (UPPERCASE, trimmed). */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Compute the discount a coupon yields against a given subtotal, clamped so it
 * never exceeds `maxDiscountFils` (when set) nor the subtotal itself. Pure math
 * — no validity checks. Returns an integer fils amount.
 */
export function computeDiscountFils(
  coupon: Pick<Coupon, "type" | "value" | "maxDiscountFils">,
  subtotalFils: number,
): number {
  let discount =
    coupon.type === CouponType.PERCENT
      ? Math.floor((subtotalFils * coupon.value) / 100)
      : coupon.value;
  if (coupon.maxDiscountFils != null) {
    discount = Math.min(discount, coupon.maxDiscountFils);
  }
  discount = Math.min(discount, subtotalFils);
  return Math.max(0, discount);
}

/**
 * Whether this phone has never placed a real-sale order — counts ORDERS (not
 * customers), so a phone that abandoned at OTP (PENDING_VERIFICATION) still
 * qualifies as a "first order".
 */
export async function isFirstOrderForPhone(
  phone: string,
  db: Db = prisma,
): Promise<boolean> {
  const count = await db.order.count({
    where: { phone, status: { in: SALES_STATUSES } },
  });
  return count === 0;
}

/**
 * Validate a coupon against an authoritative subtotal (+ optional phone) and
 * return the discount it would apply, or a tagged reason it's not usable.
 *
 * Runs both standalone (display-only `applyCouponAction`) and inside the order
 * transaction (authoritative re-check) — pass the `tx` client for the latter so
 * the read participates in the same transaction. NEVER trust a client-supplied
 * discount; this recomputes it from the stored coupon.
 */
export async function validateCoupon(
  input: ValidateCouponInput,
  db: Db = prisma,
): Promise<ValidateCouponResult> {
  const code = normalizeCouponCode(input.code);
  if (!code) return { ok: false, reason: "not_found" };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!coupon.isActive) return { ok: false, reason: "inactive" };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, reason: "not_started" };
  }
  if (coupon.expiresAt && coupon.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }

  if (input.subtotalFils < coupon.minSubtotalFils) {
    return { ok: false, reason: "below_min" };
  }

  // Global redemption cap. The concurrency-safe guard lives in
  // recordCouponRedemption; this is the early, friendly rejection.
  if (
    coupon.maxRedemptions != null &&
    coupon.timesRedeemed >= coupon.maxRedemptions
  ) {
    return { ok: false, reason: "max_redemptions" };
  }

  // Phone-scoped checks. Without a phone we can't enforce first-order /
  // per-customer limits. Rather than reject as if the rule failed, ask for the
  // phone (`phone_required`) — the shopper simply hasn't entered it yet. The
  // authoritative re-check at order time always has the verified phone.
  const phone = input.phone?.trim() || null;
  const phoneGated = coupon.firstOrderOnly || coupon.perCustomerLimit != null;
  if (phoneGated && !phone) {
    return { ok: false, reason: "phone_required" };
  }

  if (coupon.firstOrderOnly && phone) {
    const first = await isFirstOrderForPhone(phone, db);
    if (!first) return { ok: false, reason: "first_order_only" };
  }

  if (coupon.perCustomerLimit != null && phone) {
    const used = await db.couponRedemption.count({
      where: { couponId: coupon.id, phone },
    });
    if (used >= coupon.perCustomerLimit) {
      return { ok: false, reason: "per_customer_limit" };
    }
  }

  const discountFils = computeDiscountFils(coupon, input.subtotalFils);
  return { ok: true, couponId: coupon.id, code: coupon.code, discountFils };
}

/** A coupon's global redemption cap was hit during the order transaction. */
export class CouponExhaustedError extends Error {
  constructor(public readonly couponId: string) {
    super(`Coupon ${couponId} has reached its redemption cap`);
    this.name = "CouponExhaustedError";
  }
}

/**
 * Record a redemption inside the order transaction, atomically guarding the
 * global cap. We increment `timesRedeemed` with a single conditional UPDATE so
 * two concurrent checkouts can't both slip past `maxRedemptions` — Prisma can't
 * compare two columns in a `where`, so we use raw SQL and check the affected
 * row count. A zero count means the cap was hit since validateCoupon ran, so we
 * throw {@link CouponExhaustedError} to roll the whole order back.
 */
export async function recordCouponRedemption(
  input: { couponId: string; orderId: string; phone: string },
  tx: TxDb,
): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE "Coupon"
    SET "timesRedeemed" = "timesRedeemed" + 1
    WHERE "id" = ${input.couponId}
      AND ("maxRedemptions" IS NULL OR "timesRedeemed" < "maxRedemptions")
  `;
  if (affected === 0) {
    throw new CouponExhaustedError(input.couponId);
  }
  await tx.couponRedemption.create({
    data: {
      couponId: input.couponId,
      orderId: input.orderId,
      phone: input.phone,
    },
  });
}

// ─── Admin helpers ──────────────────────────────────────────────────────────

export type CouponWithCount = Coupon & { _count: { redemptions: number } };

/** All coupons, newest first, with their redemption count for the admin table. */
export async function listCoupons(): Promise<CouponWithCount[]> {
  return prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
}

export async function getCouponById(id: string): Promise<Coupon | null> {
  return prisma.coupon.findUnique({ where: { id } });
}

export type CouponWriteInput = {
  code: string;
  type: CouponType;
  value: number;
  minSubtotalFils: number;
  maxDiscountFils?: number | null;
  firstOrderOnly: boolean;
  maxRedemptions?: number | null;
  perCustomerLimit?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  isActive: boolean;
};

export async function createCoupon(input: CouponWriteInput): Promise<Coupon> {
  return prisma.coupon.create({
    data: {
      code: normalizeCouponCode(input.code),
      type: input.type,
      value: input.value,
      minSubtotalFils: input.minSubtotalFils,
      maxDiscountFils: input.maxDiscountFils ?? null,
      firstOrderOnly: input.firstOrderOnly,
      maxRedemptions: input.maxRedemptions ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      isActive: input.isActive,
    },
  });
}

export async function updateCoupon(
  id: string,
  input: CouponWriteInput,
): Promise<Coupon> {
  return prisma.coupon.update({
    where: { id },
    data: {
      code: normalizeCouponCode(input.code),
      type: input.type,
      value: input.value,
      minSubtotalFils: input.minSubtotalFils,
      maxDiscountFils: input.maxDiscountFils ?? null,
      firstOrderOnly: input.firstOrderOnly,
      maxRedemptions: input.maxRedemptions ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      isActive: input.isActive,
    },
  });
}

/** Soft-disable a coupon (keeps history; stops new redemptions). */
export async function deactivateCoupon(id: string): Promise<Coupon> {
  return prisma.coupon.update({
    where: { id },
    data: { isActive: false },
  });
}

// Unambiguous base-32 alphabet (no 0/O/1/I) for human-readable codes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a unique coupon code like `WELCOME-7K9P`, retrying until the random
 * suffix doesn't collide with an existing code. Result is UPPERCASE.
 */
export async function generateUniqueCode(prefix: string): Promise<string> {
  const base = normalizeCouponCode(prefix);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `${base}-${randomSuffix(4)}`;
    const existing = await prisma.coupon.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Astronomically unlikely; widen the suffix as a last resort.
  return `${base}-${randomSuffix(8)}`;
}
