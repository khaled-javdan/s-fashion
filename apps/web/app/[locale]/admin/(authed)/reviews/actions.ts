"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import {
  createReview,
  deleteReview,
  getReviewById,
  setReviewFlags,
  updateReview,
} from "@/lib/repos/reviews.repo"
import {
  reviewInputSchema,
  type ReviewInput,
} from "@/lib/schemas/review.schema"

/**
 * Result envelope shared by every review action. Expected errors are returned
 * (never thrown) so the client form can surface them inline, mirroring the
 * orders / settings actions.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/** Reusable admin-session guard. */
async function requireAdmin(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

/**
 * Revalidate every surface a review can appear on: the admin list, the home
 * page (testimonials + UGC strip), and — when the review is tied to a product —
 * that product's PDP. `/[locale]` covers the home page in both locales.
 */
function revalidateReviewSurfaces(): void {
  revalidatePath("/[locale]/admin/(authed)/reviews", "page")
  revalidatePath("/[locale]", "page")
  revalidatePath("/[locale]/(public)/products/[slug]", "page")
}

export async function createReviewAction(
  input: ReviewInput,
): Promise<ActionResult<{ id: string }>> {
  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: "Not authorized." }

  const parsed = reviewInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? "Invalid review." }
  }

  try {
    const review = await createReview(parsed.data)
    revalidateReviewSurfaces()
    return { ok: true, data: { id: review.id } }
  } catch (err) {
    console.error("[reviews.actions] create", err)
    return { ok: false, error: "Failed to create review." }
  }
}

export async function updateReviewAction(
  id: string,
  input: ReviewInput,
): Promise<ActionResult<{ id: string }>> {
  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: "Not authorized." }
  if (!id) return { ok: false, error: "Missing review id." }

  const parsed = reviewInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? "Invalid review." }
  }

  const existing = await getReviewById(id)
  if (!existing) return { ok: false, error: "Review not found." }

  try {
    const review = await updateReview(id, parsed.data)
    revalidateReviewSurfaces()
    return { ok: true, data: { id: review.id } }
  } catch (err) {
    console.error("[reviews.actions] update", err)
    return { ok: false, error: "Failed to update review." }
  }
}

export async function deleteReviewAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: "Not authorized." }
  if (!id) return { ok: false, error: "Missing review id." }

  try {
    await deleteReview(id)
    revalidateReviewSurfaces()
    return { ok: true, data: { id } }
  } catch (err) {
    console.error("[reviews.actions] delete", err)
    return { ok: false, error: "Failed to delete review." }
  }
}

export async function toggleReviewVisibilityAction(
  id: string,
): Promise<ActionResult<{ isVisible: boolean }>> {
  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: "Not authorized." }

  const existing = await getReviewById(id)
  if (!existing) return { ok: false, error: "Review not found." }

  try {
    const next = !existing.isVisible
    await setReviewFlags(id, { isVisible: next })
    revalidateReviewSurfaces()
    return { ok: true, data: { isVisible: next } }
  } catch (err) {
    console.error("[reviews.actions] toggle visibility", err)
    return { ok: false, error: "Failed to update review." }
  }
}

export async function toggleReviewFeaturedAction(
  id: string,
): Promise<ActionResult<{ featured: boolean }>> {
  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: "Not authorized." }

  const existing = await getReviewById(id)
  if (!existing) return { ok: false, error: "Review not found." }

  try {
    const next = !existing.featured
    await setReviewFlags(id, { featured: next })
    revalidateReviewSurfaces()
    return { ok: true, data: { featured: next } }
  } catch (err) {
    console.error("[reviews.actions] toggle featured", err)
    return { ok: false, error: "Failed to update review." }
  }
}
