import { z } from "zod";
import { CouponType } from "@workspace/db/enums";

/** Coupon code: alphanumeric + dash, normalized UPPERCASE in the repo. */
const couponCode = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/u, "letters, numbers and dashes only");

/**
 * Optional positive-integer fils/count field that accepts "" / null / undefined
 * as "unset" (→ null). The admin form sends empty strings for blank numbers.
 */
const optionalNonNegInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.number().int().min(0).nullable(),
);

const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.number().int().min(1).nullable(),
);

/** Optional date field — accepts an ISO datetime string, "" / null → null. */
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.date().nullable(),
);

/**
 * Admin create/update payload for a coupon. `value` semantics depend on `type`
 * (PERCENT: 1–100, FIXED: fils ≥ 1) and are refined accordingly. Money + count
 * caps are nullable ("unlimited" / "no cap").
 */
export const couponWriteSchema = z
  .object({
    code: couponCode,
    type: z.nativeEnum(CouponType),
    value: z.number().int().min(1),
    minSubtotalFils: z.number().int().min(0).default(0),
    maxDiscountFils: optionalNonNegInt,
    firstOrderOnly: z.boolean().default(false),
    maxRedemptions: optionalPositiveInt,
    perCustomerLimit: optionalPositiveInt,
    startsAt: optionalDate,
    expiresAt: optionalDate,
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === CouponType.PERCENT && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "percent must be 1–100",
      });
    }
    if (
      data.startsAt &&
      data.expiresAt &&
      data.expiresAt <= data.startsAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "expiry must be after the start date",
      });
    }
    // A percent cap only makes sense for PERCENT coupons.
    if (data.type === CouponType.FIXED && data.maxDiscountFils != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxDiscountFils"],
        message: "a discount cap only applies to percent coupons",
      });
    }
  });

export type CouponWriteSchemaInput = z.input<typeof couponWriteSchema>;
export type CouponWriteSchemaOutput = z.infer<typeof couponWriteSchema>;
