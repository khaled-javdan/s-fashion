import { z } from "zod";

/** A cuid (Prisma's default id format) — used for the optional product link. */
const cuid = z.string().cuid();

/**
 * A review's editable fields. Mirrors the `Review` Prisma model (minus the
 * server-managed id / timestamps).
 *
 * Empty strings coming from <input>/<select> are coerced to `undefined` for the
 * optional fields so an untouched control clears the column rather than writing
 * `""`. `productId` accepts a cuid or empty (→ undefined = a non-product, e.g.
 * an Instagram repost). `displayDate` is coerced from the date input's string.
 */
export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  authorName: z.string().trim().min(1).max(120),
  authorHandle: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v : undefined)),
  body: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : undefined)),
  source: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
  productId: z
    .union([cuid, z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  imageUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  featured: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  displayDate: z.coerce.date().optional(),
  sortOrder: z.number().int().default(0),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

/**
 * A customer-submitted product review (the public "Write a review" form on the
 * PDP). Far stricter than the admin schema: rating + name + a real comment are
 * required, email is optional, and everything else (visibility, featured,
 * source, product link) is set server-side — never trusted from the client.
 *
 * The `turnstileToken` is verified server-side for bot protection (mirrors the
 * checkout OTP flow); it is gated/skipped when Turnstile is not configured.
 */
export const customerReviewSchema = z.object({
  productId: cuid,
  rating: z.number().int().min(1).max(5),
  authorName: z.string().trim().min(2).max(80),
  authorEmail: z
    .union([z.string().trim().email(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  body: z.string().trim().min(10).max(2000),
  turnstileToken: z.string().optional(),
});

export type CustomerReviewInput = z.infer<typeof customerReviewSchema>;
