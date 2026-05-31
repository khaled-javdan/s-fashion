import { prisma } from "@workspace/db";
import type { Review } from "@workspace/db";

import type { ReviewInput } from "@/lib/schemas/review.schema";

export type { Review };

/** Aggregate rating for a product (or the whole store). */
export type RatingSummary = { average: number; count: number };

/** Round an average to a single decimal place (e.g. 4.27 → 4.3). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Featured + visible reviews for the home page / social-proof rails.
 *
 * Ordered by `sortOrder` asc (the admin's manual ranking), then `displayDate`
 * desc with NULLs last (so dated reviews lead, undated trail), then newest
 * `createdAt` as a final tie-breaker.
 */
export async function listFeaturedReviews(take?: number): Promise<Review[]> {
  return prisma.review.findMany({
    where: { featured: true, isVisible: true },
    orderBy: [
      { sortOrder: "asc" },
      { displayDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take,
  });
}

/** Visible reviews for one product's PDP, newest first. */
export async function listProductReviews(productId: string): Promise<Review[]> {
  return prisma.review.findMany({
    where: { productId, isVisible: true },
    orderBy: [
      { displayDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
}

/**
 * Average rating + count for a single product, over visible rows only.
 * Returns `{ average: 0, count: 0 }` when the product has no visible reviews.
 */
export async function getProductRatingSummary(
  productId: string,
): Promise<RatingSummary> {
  const agg = await prisma.review.aggregate({
    where: { productId, isVisible: true },
    _avg: { rating: true },
    _count: true,
  });
  const count = agg._count ?? 0;
  return {
    average: agg._avg.rating != null ? round1(agg._avg.rating) : 0,
    count,
  };
}

/**
 * Batched rating summaries for a set of products (e.g. a listing grid), so the
 * caller makes one query instead of N. Products with no visible reviews are
 * simply absent from the map. Returns an empty map for empty input.
 */
export async function getRatingSummaries(
  productIds: string[],
): Promise<Map<string, RatingSummary>> {
  const map = new Map<string, RatingSummary>();
  if (productIds.length === 0) return map;

  const grouped = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, isVisible: true },
    _avg: { rating: true },
    _count: true,
  });

  for (const row of grouped) {
    if (!row.productId) continue;
    map.set(row.productId, {
      average: row._avg.rating != null ? round1(row._avg.rating) : 0,
      count: row._count,
    });
  }
  return map;
}

/** Cheap existence check: is this an active (purchasable) product? */
export async function isActiveProduct(productId: string): Promise<boolean> {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });
  return product !== null;
}

/**
 * Persist a customer-submitted review from the PDP "Write a review" form.
 *
 * Always lands in the moderation queue (`isVisible: false`,
 * `isCustomerSubmitted: true`) so nothing goes live until an admin approves it.
 * `source`/`displayDate` are stamped server-side; the body is stored as-written.
 */
export async function createCustomerReview(data: {
  productId: string;
  rating: number;
  authorName: string;
  authorEmail?: string;
  body: string;
}): Promise<Review> {
  return prisma.review.create({
    data: {
      product: { connect: { id: data.productId } },
      rating: data.rating,
      authorName: data.authorName,
      authorEmail: data.authorEmail ?? null,
      body: data.body,
      source: "website",
      isVisible: false,
      isCustomerSubmitted: true,
      displayDate: new Date(),
    },
  });
}

// ── Admin helpers ──────────────────────────────────────────────────────────

/** All reviews for the admin table, manual order then newest. */
export async function listAllReviews(): Promise<Review[]> {
  return prisma.review.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getReviewById(id: string): Promise<Review | null> {
  return prisma.review.findUnique({ where: { id } });
}

export async function createReview(data: ReviewInput): Promise<Review> {
  return prisma.review.create({
    data: {
      rating: data.rating,
      authorName: data.authorName,
      authorHandle: data.authorHandle ?? null,
      body: data.body ?? null,
      source: data.source ?? null,
      product: data.productId ? { connect: { id: data.productId } } : undefined,
      imageUrl: data.imageUrl ?? null,
      featured: data.featured,
      isVisible: data.isVisible,
      displayDate: data.displayDate ?? null,
      sortOrder: data.sortOrder,
    },
  });
}

export async function updateReview(
  id: string,
  data: ReviewInput,
): Promise<Review> {
  return prisma.review.update({
    where: { id },
    data: {
      rating: data.rating,
      authorName: data.authorName,
      authorHandle: data.authorHandle ?? null,
      body: data.body ?? null,
      source: data.source ?? null,
      product: data.productId
        ? { connect: { id: data.productId } }
        : { disconnect: true },
      imageUrl: data.imageUrl ?? null,
      featured: data.featured,
      isVisible: data.isVisible,
      displayDate: data.displayDate ?? null,
      sortOrder: data.sortOrder,
    },
  });
}

export async function deleteReview(id: string): Promise<void> {
  await prisma.review.delete({ where: { id } });
}

/**
 * Flip the visibility / featured flags without touching the rest of the row.
 * Each flag is optional — pass only the ones you want to change.
 */
export async function setReviewFlags(
  id: string,
  flags: { isVisible?: boolean; featured?: boolean },
): Promise<Review> {
  return prisma.review.update({
    where: { id },
    data: {
      ...(flags.isVisible === undefined ? {} : { isVisible: flags.isVisible }),
      ...(flags.featured === undefined ? {} : { featured: flags.featured }),
    },
  });
}
