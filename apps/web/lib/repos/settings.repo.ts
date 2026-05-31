import { prisma, Prisma } from "@workspace/db";
import type { Setting } from "@workspace/db";

import type { CurrencyConfig } from "@/lib/currency-config";
import type { GridConfig } from "@/lib/grid-config";
import type { ShippingConfig } from "@/lib/shipping-config";
import type { ShopByConfig } from "@/lib/shop-by-config";

/**
 * Known settings registry — keep in sync with the seed file and SPEC §4.
 * Each entry maps a key to its TypeScript shape; getSetting overloads use these.
 */
export type KnownSettings = {
  /** Per-country flat fee + free threshold (base AED fils). */
  "shipping.countries": ShippingConfig;
  /** Enabled display currencies + manual AED→currency rates. */
  "currency.config": CurrencyConfig;
  "contact.whatsapp_number": string;
  "contact.business_hours_ar": string;
  "contact.business_hours_en": string;
  /** Public contact email shown on the contact page (may be empty). */
  "contact.email": string;
  /** Social profile URLs surfaced in the footer (each may be empty). */
  "contact.social": {
    instagram: string;
    tiktok: string;
    snapchat: string;
  };
  /** Returns window in days, surfaced on the returns page. */
  "returns.window_days": number;
  "size_chart.cm": {
    unit: "cm";
    rows: Array<{
      size: string;
      bust: number | null;
      waist: number | null;
      hips: number | null;
      length: number;
    }>;
  };
  "order.max_items": number;
  "order.max_qty_per_variant": number;
  /** Gateway model id for the admin AI copilot (see AI_MODEL_OPTIONS). */
  "ai.model": string;
  /** Storefront product-grid columns per breakpoint. */
  "home.grid": GridConfig;
  /** Admin-configured "Shop by" image tiles on the home page. */
  "home.shop_by": ShopByConfig;
  /**
   * Bilingual shipping & return copy rendered in the PDP tabs. Shared across
   * every product (per-product overrides intentionally not modelled).
   */
  "product.shipping_return": {
    contentAr: string;
    contentEn: string;
  };
};

/**
 * One approved product-copy example used to prime the AI's brand voice.
 * Stored as a JSON array under the `ai.few_shot_examples` setting and edited
 * via Prisma Studio for now (admin UI is a Phase 2 follow-up). Intentionally
 * NOT part of `KnownSettings` — it isn't editable through the settings form,
 * so the few-shot getter reads it via the generic `getSetting` overload.
 */
export type FewShotExample = {
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
};

export type SettingKey = keyof KnownSettings;

// Overload for known keys (returns the typed value), and a generic fallback.
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<KnownSettings[K] | null>;
export async function getSetting<T = unknown>(key: string): Promise<T | null>;
export async function getSetting(key: string): Promise<unknown> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? (row.value as unknown) : null;
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: KnownSettings[K],
): Promise<Setting>;
export async function setSetting(
  key: string,
  value: unknown,
): Promise<Setting>;
export async function setSetting(
  key: string,
  value: unknown,
): Promise<Setting> {
  return prisma.setting.upsert({
    where: { key },
    update: { value: value as Prisma.InputJsonValue },
    create: { key, value: value as Prisma.InputJsonValue },
  });
}

/**
 * Typed getter for the AI few-shot priming examples. Returns `null` when the
 * setting is absent or malformed — the prompt builders treat null as "no
 * examples" and fall back to the generic brand-voice prompt. Additive helper;
 * does not change any existing function.
 */
export async function getAiFewShotExamples(): Promise<FewShotExample[] | null> {
  const raw = await getSetting<unknown>("ai.few_shot_examples");
  if (!Array.isArray(raw)) return null;
  const examples = raw.filter(
    (e): e is FewShotExample =>
      !!e &&
      typeof e === "object" &&
      typeof (e as FewShotExample).nameEn === "string" &&
      typeof (e as FewShotExample).nameAr === "string" &&
      typeof (e as FewShotExample).descEn === "string" &&
      typeof (e as FewShotExample).descAr === "string",
  );
  return examples.length > 0 ? examples : null;
}

/** Returns all settings as a key → value map (raw JSON values). */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany();
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    out[row.key] = row.value;
  }
  return out;
}
