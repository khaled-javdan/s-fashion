"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@workspace/db"

import { auth } from "@/lib/auth"
import { toActionError } from "@/lib/errors"
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  setCategoryProducts,
  updateCategory,
} from "@/lib/repos/categories.repo"
import {
  categoryWriteSchema,
  idListSchema,
  type CategoryWriteSchemaInput,
} from "@/lib/schemas/category.schema"

/** Standard action result. Expected errors are returned, never thrown. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Not authorized." }
  }
  return { ok: true }
}

const SLUG_TAKEN = "A category with this slug already exists."

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  )
}

/**
 * Admin categories + product pages show membership; the storefront shows
 * categories in the menu, shop filter, category pages and product pages.
 */
function revalidateCategories() {
  revalidatePath("/[locale]/admin/(authed)/categories", "layout")
  revalidatePath("/[locale]/admin/(authed)/products", "layout")
  revalidatePath("/[locale]", "layout")
}

/** Create a category. Returns the new id so the client can navigate to it. */
export async function createCategoryAction(
  payload: CategoryWriteSchemaInput,
): Promise<ActionResult<{ id: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  const parsed = categoryWriteSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      error: toActionError("createCategoryAction.validate", parsed.error),
    }
  }

  try {
    const category = await createCategory(parsed.data)
    revalidateCategories()
    return { ok: true, data: { id: category.id } }
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: SLUG_TAKEN }
    return { ok: false, error: toActionError("createCategoryAction", err) }
  }
}

/** Update a category's names / slug / visibility. */
export async function updateCategoryAction(
  id: string,
  payload: CategoryWriteSchemaInput,
): Promise<ActionResult<{ id: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing category id." }
  }

  const parsed = categoryWriteSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      error: toActionError("updateCategoryAction.validate", parsed.error),
    }
  }

  try {
    const category = await updateCategory(id, parsed.data)
    revalidateCategories()
    return { ok: true, data: { id: category.id } }
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: SLUG_TAKEN }
    return { ok: false, error: toActionError("updateCategoryAction", err) }
  }
}

/** Replace the full set of products in a category. */
export async function setCategoryProductsAction(
  id: string,
  productIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing category id." }
  }
  const parsed = idListSchema.safeParse(productIds)
  if (!parsed.success) {
    return { ok: false, error: "Invalid product list." }
  }

  try {
    await setCategoryProducts(id, parsed.data)
    revalidateCategories()
    return { ok: true, data: { count: new Set(parsed.data).size } }
  } catch (err) {
    return {
      ok: false,
      error: toActionError("setCategoryProductsAction", err, {
        extra: { id, count: parsed.data.length },
      }),
    }
  }
}

/** Persist a new category order. `ids` is the full list, top to bottom. */
export async function reorderCategoriesAction(
  ids: string[],
): Promise<ActionResult<null>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  const parsed = idListSchema.safeParse(ids)
  if (!parsed.success) {
    return { ok: false, error: "Invalid category order." }
  }

  try {
    await reorderCategories(parsed.data)
    revalidateCategories()
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, error: toActionError("reorderCategoriesAction", err) }
  }
}

/** Delete a category. Products stay; only their link to it is removed. */
export async function deleteCategoryAction(
  id: string,
): Promise<ActionResult<null>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing category id." }
  }

  try {
    await deleteCategory(id)
    revalidateCategories()
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, error: toActionError("deleteCategoryAction", err) }
  }
}
