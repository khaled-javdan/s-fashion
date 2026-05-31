"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { aedToFils } from "@/lib/money"
import {
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/lib/repos/products.repo"
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
  type SizeChartInput,
} from "@/lib/schemas/product.schema"
import {
  deleteProductImage,
  uploadProductImage,
} from "@/lib/services/blob"

/** Standard action result. Never throw across the boundary for expected errors. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

/** Per-product size chart the form submits (centimetre measurements). */
export type SizeChartFormChart = SizeChartInput

/**
 * The form submits AED decimals for money fields. The action converts them to
 * integer fils before persisting. This is the shape the client sends — money is
 * AED here, everything else mirrors the Zod schema (minus the fils fields).
 */
export type ProductFormPayload = {
  slug: string
  nameAr: string
  nameEn: string
  descAr?: string | null
  descEn?: string | null
  additionalInfoAr?: string | null
  additionalInfoEn?: string | null
  priceAed: number
  compareAtAed?: number | null
  costPriceAed: number
  isActive: boolean
  isFinalSale: boolean
  /**
   * Per-product size chart override. `null` (or omitted) means "use the global
   * default"; a value is the per-product chart (measurements in centimetres).
   */
  sizeChart?: SizeChartFormChart | null
  variants: Array<{
    id?: string
    colorNameAr?: string | null
    colorNameEn?: string | null
    colorHex?: string | null
    size: ProductCreateInput["variants"][number]["size"]
    stock: number
    sku?: string | null
  }>
  images: Array<{
    id?: string
    url: string
    altAr?: string | null
    altEn?: string | null
    colorHex?: string | null
    position: number
  }>
}

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Not authorized." }
  }
  return { ok: true }
}

/** Reject duplicate (colorHex, size) pairs within the submitted variant set. */
function hasDuplicateVariant(
  variants: ProductFormPayload["variants"],
): boolean {
  const seen = new Set<string>()
  for (const v of variants) {
    const key = `${(v.colorHex ?? "").toLowerCase()}::${v.size}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

/**
 * Upload a single product image to Vercel Blob.
 * Validates auth, MIME type and size before delegating to the blob wrapper.
 */
export async function uploadProductImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." }
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Unsupported file type. Use JPEG, PNG, or WebP.",
    }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image is larger than 8 MB." }
  }

  const result = await uploadProductImage(file, file.name || "image")
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return { ok: true, data: { url: result.url } }
}

/** Delete an uploaded image from Vercel Blob (used when removing a thumb). */
export async function deleteProductImageAction(
  url: string,
): Promise<ActionResult<null>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof url !== "string" || url.length === 0) {
    return { ok: false, error: "No image URL provided." }
  }

  const result = await deleteProductImage(url)
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return { ok: true, data: null }
}

/** Map the AED form payload onto the fils-based create schema input. */
function toCreateInput(payload: ProductFormPayload): ProductCreateInput {
  return productCreateSchema.parse({
    slug: payload.slug,
    nameAr: payload.nameAr,
    nameEn: payload.nameEn,
    descAr: payload.descAr ?? null,
    descEn: payload.descEn ?? null,
    additionalInfoAr: payload.additionalInfoAr ?? null,
    additionalInfoEn: payload.additionalInfoEn ?? null,
    priceFils: aedToFils(payload.priceAed),
    compareAtFils:
      payload.compareAtAed != null && payload.compareAtAed > 0
        ? aedToFils(payload.compareAtAed)
        : null,
    costPriceFils: aedToFils(payload.costPriceAed),
    isActive: payload.isActive,
    isFinalSale: payload.isFinalSale,
    sizeChart: payload.sizeChart ?? null,
    variants: payload.variants.map((v) => ({
      id: v.id,
      colorNameAr: v.colorNameAr ?? null,
      colorNameEn: v.colorNameEn ?? null,
      colorHex: v.colorHex ?? null,
      size: v.size,
      stock: v.stock,
      sku: v.sku ? v.sku : null,
    })),
    images: payload.images.map((i, idx) => ({
      id: i.id,
      url: i.url,
      altAr: i.altAr ?? null,
      altEn: i.altEn ?? null,
      colorHex: i.colorHex ?? null,
      position: i.position ?? idx,
    })),
  })
}

function toUpdateInput(payload: ProductFormPayload): ProductUpdateInput {
  return productUpdateSchema.parse({
    slug: payload.slug,
    nameAr: payload.nameAr,
    nameEn: payload.nameEn,
    descAr: payload.descAr ?? null,
    descEn: payload.descEn ?? null,
    additionalInfoAr: payload.additionalInfoAr ?? null,
    additionalInfoEn: payload.additionalInfoEn ?? null,
    priceFils: aedToFils(payload.priceAed),
    compareAtFils:
      payload.compareAtAed != null && payload.compareAtAed > 0
        ? aedToFils(payload.compareAtAed)
        : null,
    costPriceFils: aedToFils(payload.costPriceAed),
    isActive: payload.isActive,
    isFinalSale: payload.isFinalSale,
    sizeChart: payload.sizeChart ?? null,
    variants: payload.variants.map((v) => ({
      id: v.id,
      colorNameAr: v.colorNameAr ?? null,
      colorNameEn: v.colorNameEn ?? null,
      colorHex: v.colorHex ?? null,
      size: v.size,
      stock: v.stock,
      sku: v.sku ? v.sku : null,
    })),
    images: payload.images.map((i, idx) => ({
      id: i.id,
      url: i.url,
      altAr: i.altAr ?? null,
      altEn: i.altEn ?? null,
      colorHex: i.colorHex ?? null,
      position: i.position ?? idx,
    })),
  })
}

/** Create a product. Returns the new product id so the client can navigate. */
export async function createProductAction(
  payload: ProductFormPayload,
): Promise<ActionResult<{ id: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (hasDuplicateVariant(payload.variants)) {
    return {
      ok: false,
      error: "Each colour + size combination must be unique.",
    }
  }

  let input: ProductCreateInput
  try {
    input = toCreateInput(payload)
  } catch (err) {
    return { ok: false, error: zodMessage(err) }
  }

  try {
    const product = await createProduct(input)
    revalidatePath("/admin/products")
    return { ok: true, data: { id: product.id } }
  } catch (err) {
    return { ok: false, error: dbMessage(err) }
  }
}

/** Update an existing product. */
export async function updateProductAction(
  id: string,
  payload: ProductFormPayload,
): Promise<ActionResult<{ id: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing product id." }
  }

  if (hasDuplicateVariant(payload.variants)) {
    return {
      ok: false,
      error: "Each colour + size combination must be unique.",
    }
  }

  let input: ProductUpdateInput
  try {
    input = toUpdateInput(payload)
  } catch (err) {
    return { ok: false, error: zodMessage(err) }
  }

  try {
    const product = await updateProduct(id, input)
    revalidatePath("/admin/products")
    revalidatePath(`/admin/products/${id}`)
    return { ok: true, data: { id: product.id } }
  } catch (err) {
    return { ok: false, error: dbMessage(err) }
  }
}

/** Soft delete / toggle visibility. Returns the new active state. */
export async function toggleProductActiveAction(
  id: string,
): Promise<ActionResult<{ isActive: boolean }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing product id." }
  }

  try {
    const isActive = await toggleProductActive(id)
    revalidatePath("/admin/products")
    revalidatePath(`/admin/products/${id}`)
    return { ok: true, data: { isActive } }
  } catch (err) {
    return { ok: false, error: dbMessage(err) }
  }
}

function zodMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown[] }).issues)
  ) {
    const issues = (err as { issues: Array<{ path: unknown[]; message: string }> })
      .issues
    const first = issues[0]
    if (first) {
      const path = first.path.join(".")
      return path ? `${path}: ${first.message}` : first.message
    }
  }
  return "Invalid product data."
}

function dbMessage(err: unknown): string {
  // Surface unique-constraint conflicts (slug / sku) in a friendly way.
  const message = err instanceof Error ? err.message : ""
  if (message.includes("Unique constraint") || message.includes("P2002")) {
    return "A product with that slug or SKU already exists."
  }
  console.error("[products.actions]", err)
  return "Something went wrong. Please try again."
}
