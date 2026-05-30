"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isAllowedModelId } from "@/components/admin/ai/types"
import { auth } from "@/lib/auth"
import { gridConfigSchema } from "@/lib/grid-config"
import { heroConfigSchema, type HeroConfig } from "@/lib/hero-config"
import {
  setSetting,
  type KnownSettings,
  type SettingKey,
} from "@/lib/repos/settings.repo"
import { uploadProductImage } from "@/lib/services/blob"

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

const sizeChartRow = z.object({
  size: z.string().trim().min(1).max(20),
  bust: z.number().int().min(0).nullable(),
  waist: z.number().int().min(0).nullable(),
  hips: z.number().int().min(0).nullable(),
  length: z.number().int().min(0),
})

/**
 * Per-key validation. Each setting is validated against its known shape so a
 * malformed payload from the client never lands in the DB.
 */
const settingValidators: {
  [K in SettingKey]: z.ZodType<KnownSettings[K]>
} = {
  "shipping.flat_fils": z.number().int().min(0),
  "shipping.free_threshold_fils": z.number().int().min(0),
  "contact.whatsapp_number": z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,15}$/u, "Use international format, e.g. +9715XXXXXXXX"),
  "contact.business_hours_ar": z.string().trim().min(1).max(120),
  "contact.business_hours_en": z.string().trim().min(1).max(120),
  "size_chart.cm": z.object({
    unit: z.literal("cm"),
    rows: z.array(sizeChartRow).min(1),
  }),
  "order.max_items": z.number().int().min(1).max(100),
  "order.max_qty_per_variant": z.number().int().min(1).max(20),
  "ai.model": z
    .string()
    .refine(isAllowedModelId, "Unknown AI model."),
  "home.grid": gridConfigSchema,
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
    await persist(input.key, parsed.data)
    revalidatePath("/admin/settings")
    // The grid layout is rendered on the storefront home; refresh it too.
    if (input.key === "home.grid") {
      revalidatePath("/[locale]", "page")
    }
    return { ok: true, data: null }
  } catch (err) {
    console.error("[settings.actions]", err)
    return { ok: false, error: "Failed to save. Please try again." }
  }
}

/** Narrow per-key persist so the typed `setSetting` overloads stay satisfied. */
async function persist(
  key: SettingKey,
  value: KnownSettings[SettingKey],
): Promise<void> {
  switch (key) {
    case "shipping.flat_fils":
    case "shipping.free_threshold_fils":
    case "order.max_items":
    case "order.max_qty_per_variant":
      await setSetting(key, value as number)
      return
    case "contact.whatsapp_number":
    case "contact.business_hours_ar":
    case "contact.business_hours_en":
    case "ai.model":
      await setSetting(key, value as string)
      return
    case "size_chart.cm":
      await setSetting(key, value as KnownSettings["size_chart.cm"])
      return
    case "home.grid":
      await setSetting(key, value as KnownSettings["home.grid"])
      return
    default: {
      const _exhaustive: never = key
      throw new Error(`Unhandled setting key: ${String(_exhaustive)}`)
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
    console.error("[settings.actions] hero", err)
    return { ok: false, error: "Failed to save. Please try again." }
  }
}
