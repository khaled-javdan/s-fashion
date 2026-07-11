"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isAllowedModelId } from "@/components/admin/ai/types"
import { auth } from "@/lib/auth"
import { toActionError } from "@/lib/errors"
import { currencyConfigSchema } from "@/lib/currency-config"
import { gridConfigSchema } from "@/lib/grid-config"
import { homeLayoutConfigSchema } from "@/lib/home-sections-config"
import { ABSOLUTE_MAX_QTY_PER_VARIANT } from "@/lib/order-limits"
import { shippingConfigSchema } from "@/lib/shipping-config"
import { heroConfigSchema, type HeroConfig } from "@/lib/hero-config"
import { shopByConfigSchema } from "@/lib/shop-by-config"
import {
  setSetting,
  type KnownSettings,
  type SettingKey,
} from "@/lib/repos/settings.repo"
import { listAllProductsForAdmin } from "@/lib/repos/products.repo"
import { uploadProductImage } from "@/lib/services/blob"

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

/** A social profile URL that may be left empty (validated as a URL otherwise). */
const socialUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || z.string().url().safeParse(v).success, {
    message: "Enter a valid URL.",
  })

const sizeChartRow = z.object({
  size: z.string().trim().min(1).max(20),
  shoulder: z.number().min(0).nullable().default(null),
  bust: z.number().min(0).nullable(),
  waist: z.number().min(0).nullable(),
  hips: z.number().min(0).nullable(),
  sleeves: z.number().min(0).nullable().default(null),
  length: z.number().min(0),
})

/**
 * Per-key validation. Each setting is validated against its known shape so a
 * malformed payload from the client never lands in the DB.
 */
const settingValidators: Record<SettingKey, z.ZodTypeAny> = {
  "market.mode": z.enum(["uae", "gcc"]),
  "shipping.countries": shippingConfigSchema,
  "currency.config": currencyConfigSchema,
  "contact.whatsapp_number": z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,15}$/u, "Use international format, e.g. +9715XXXXXXXX"),
  "contact.business_hours_ar": z.string().trim().min(1).max(120),
  "contact.business_hours_en": z.string().trim().min(1).max(120),
  "contact.email": z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address.",
    }),
  "contact.social": z.object({
    instagram: socialUrl,
    tiktok: socialUrl,
    snapchat: socialUrl,
  }),
  "returns.window_days": z.number().int().min(0).max(90),
  "company.legal_name": z.string().trim().max(200),
  "company.trade_license": z.string().trim().max(100),
  "company.vat_trn": z.string().trim().max(50),
  "size_chart.cm": z.object({
    unit: z.enum(["in", "cm"]),
    rows: z.array(sizeChartRow).min(1),
  }),
  "order.max_items": z.number().int().min(1).max(100),
  "order.max_qty_per_variant": z
    .number()
    .int()
    .min(1)
    .max(ABSOLUTE_MAX_QTY_PER_VARIANT),
  "ai.model": z
    .string()
    .refine(isAllowedModelId, "Unknown AI model."),
  "home.grid": gridConfigSchema,
  "home.shop_by": shopByConfigSchema,
  "home.sections": homeLayoutConfigSchema,
  "product.shipping_return": z.object({
    contentAr: z.string().trim().max(4000),
    contentEn: z.string().trim().max(4000),
  }),
  "marketing.whatsapp_enabled": z.boolean(),
  "marketing.welcome_discount_percent": z.number().int().min(1).max(100),
  "payments.stripe_enabled": z.boolean(),
}

function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(settingValidators, key)
}

/**
 * Persist a single setting after validating both the key and its value shape.
 * Returns `{ ok: true, data: null }` on success.
 */
export async function updateSettingsAction(input: {
  key: string
  value: unknown
}): Promise<ActionResult<null>> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Not authorized." }
  }

  if (!isSettingKey(input.key)) {
    return { ok: false, error: `Unknown setting: ${input.key}` }
  }

  const validator = settingValidators[input.key]
  const parsed = validator.safeParse(input.value)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      ok: false,
      error: first?.message ?? "Invalid value.",
    }
  }

  try {
    // Each branch keeps the value type aligned with its key for the overload.
    await persist(input.key, parsed.data as KnownSettings[SettingKey])
    revalidatePath("/admin/settings")
    // These settings affect the storefront; refresh it too.
    if (
      input.key === "home.grid" ||
      input.key === "home.shop_by" ||
      input.key === "home.sections" ||
      input.key === "shipping.countries" ||
      input.key === "currency.config" ||
      input.key === "market.mode" ||
      input.key === "returns.window_days" ||
      input.key === "marketing.whatsapp_enabled" ||
      input.key === "marketing.welcome_discount_percent" ||
      input.key === "payments.stripe_enabled"
    ) {
      revalidatePath("/[locale]", "page")
    }
    // Footer (rendered in the storefront layout) reads contact settings, so
    // refresh the whole layout subtree when those change.
    if (
      input.key === "contact.email" ||
      input.key === "contact.social" ||
      input.key === "contact.business_hours_ar" ||
      input.key === "contact.business_hours_en" ||
      input.key === "company.legal_name" ||
      input.key === "company.trade_license" ||
      input.key === "company.vat_trn"
    ) {
      revalidatePath("/[locale]", "layout")
    }
    return { ok: true, data: null }
  } catch (err) {
    return {
      ok: false,
      error: toActionError("updateSettingsAction", err),
    }
  }
}

/** Narrow per-key persist so the typed `setSetting` overloads stay satisfied. */
async function persist(
  key: SettingKey,
  value: KnownSettings[SettingKey],
): Promise<void> {
  switch (key) {
    case "market.mode":
      await setSetting(key, value as KnownSettings["market.mode"])
      return
    case "order.max_items":
    case "order.max_qty_per_variant":
    case "returns.window_days":
      await setSetting(key, value as number)
      return
    case "shipping.countries":
      await setSetting(key, value as KnownSettings["shipping.countries"])
      return
    case "currency.config":
      await setSetting(key, value as KnownSettings["currency.config"])
      return
    case "contact.whatsapp_number":
    case "contact.business_hours_ar":
    case "contact.business_hours_en":
    case "contact.email":
    case "company.legal_name":
    case "company.trade_license":
    case "company.vat_trn":
    case "ai.model":
      await setSetting(key, value as string)
      return
    case "contact.social":
      await setSetting(key, value as KnownSettings["contact.social"])
      return
    case "size_chart.cm":
      await setSetting(key, value as KnownSettings["size_chart.cm"])
      return
    case "home.grid":
      await setSetting(key, value as KnownSettings["home.grid"])
      return
    case "home.shop_by":
      await setSetting(key, value as KnownSettings["home.shop_by"])
      return
    case "home.sections":
      await setSetting(key, value as KnownSettings["home.sections"])
      return
    case "product.shipping_return":
      await setSetting(key, value as KnownSettings["product.shipping_return"])
      return
    case "marketing.whatsapp_enabled":
    case "payments.stripe_enabled":
      await setSetting(key, value as boolean)
      return
    case "marketing.welcome_discount_percent":
      await setSetting(key, value as number)
      return
    default: {
      const _exhaustive: never = key
      throw new Error(`Unhandled setting key: ${String(_exhaustive)}`)
    }
  }
}

/** A product hit for the home-sections manual-mode picker. */
export type ProductPickerResult = {
  id: string
  nameEn: string
  nameAr: string
  imageUrl: string | null
  /** false = hidden from the storefront; picking it is allowed but it won't
   * render on the live home page until it's reactivated. */
  isActive: boolean
}

/**
 * The full catalogue (active AND hidden), thumbnail-first, for the
 * home-sections manual-mode picker. The admin browses by photo (they often
 * recognise a product by look before they recall its name) and can
 * optionally type to narrow the grid; the catalogue is small enough to send
 * in one shot rather than build a live search. Hidden products are included
 * (flagged) so the admin can pre-stage a row before flipping a product live,
 * rather than the picker mysteriously excluding some products.
 */
export async function listProductsForPickerAction(): Promise<
  ActionResult<ProductPickerResult[]>
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Not authorized." }
  }

  try {
    const products = await listAllProductsForAdmin()
    return {
      ok: true,
      data: products.map((p) => ({
        id: p.id,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        imageUrl: p.images[0]?.url ?? null,
        isActive: p.isActive,
      })),
    }
  } catch (err) {
    return {
      ok: false,
      error: toActionError("listProductsForPickerAction", err),
    }
  }
}

/**
 * Upload the home hero image to Vercel Blob.
 * Validates auth, MIME type and size before delegating to the blob wrapper.
 */
export async function uploadHeroImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Not authorized." }
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." }
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Unsupported file type. Use JPEG, PNG, or WebP." }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image is larger than 8 MB." }
  }

  const result = await uploadProductImage(file, file.name || "hero")
  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  return { ok: true, data: { url: result.url } }
}

/**
 * Persist the home hero configuration. Validates the full shape (and the
 * "image required when enabled" rule) before saving, then revalidates the
 * storefront home so the change is live immediately.
 */
export async function updateHeroAction(
  input: HeroConfig,
): Promise<ActionResult<null>> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Not authorized." }
  }

  const parsed = heroConfigSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? "Invalid hero configuration." }
  }

  try {
    await setSetting("home.hero", parsed.data)
    revalidatePath("/admin/settings")
    revalidatePath("/[locale]", "page")
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, error: toActionError("updateHeroAction", err) }
  }
}
