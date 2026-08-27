import { prisma, Prisma } from "@workspace/db";
import type { Setting } from "@workspace/db";

import type { CurrencyConfig } from "@/lib/currency-config";
import type { GridConfig } from "@/lib/grid-config";
import type { HomeLayoutConfig } from "@/lib/home-sections-config";
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
  /** Registered legal entity name shown in the footer (may be empty). */
  "company.legal_name": string;
  /**
   * UAE trade licence number shown in the footer for consumer-protection
   * compliance (may be empty until issued).
   */
  "company.trade_license": string;
  /** VAT Tax Registration Number shown in the footer when registered. */
  "company.vat_trn": string;
  /**
   * Storefront fallback when a product has no per-product chart override. Key
   * name is retained ("size_chart.cm") for backward compatibility — the `unit`
   * field is the source of truth (defaults to "in" for new charts).
   */
  "size_chart.cm": {
    unit: "in" | "cm";
    rows: Array<{
      size: string;
      shoulder: number | null;
      bust: number | null;
      waist: number | null;
      hips: number | null;
      sleeves: number | null;
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
  /** Home-page layout: ordered static + product blocks (Shopify-style organiser). */
  "home.sections": HomeLayoutConfig;
  /**
   * Active market scope.
   * - "uae": only UAE is offered; currency switcher is hidden.
   * - "gcc": all per-country enabled flags in `shipping.countries` apply.
   * Defaults to "uae" when unset.
   */
  "market.mode": "uae" | "gcc";
  /**
   * Bilingual shipping & return copy rendered in the PDP tabs. Shared across
   * every product (per-product overrides intentionally not modelled).
   */
  "product.shipping_return": {
    contentAr: string;
    contentEn: string;
  };
  /**
   * Whether the WhatsApp subscription form (inline home section) and popup
   * are shown to visitors. Defaults to true when unset.
   */
  "marketing.whatsapp_enabled": boolean;
  /**
   * Discount percentage issued as the welcome coupon for new WhatsApp
   * subscribers. Defaults to 10 when unset.
   */
  "marketing.welcome_discount_percent": number;
  /**
   * Whether Stripe online card payment is offered at checkout. Defaults to
   * false when unset; also requires STRIPE_SECRET_KEY to be configured.
   */
  "payments.stripe_enabled": boolean;
  /**
   * Last-chance discount offered when a shopper looks like they're leaving the
   * checkout page. `percent` is applied to the item subtotal only (shipping is
   * added after the discount, so it is never discounted), and `minutes` is the
   * real validity of the minted single-use coupon — the countdown the customer
   * sees is that same deadline, not decoration. Defaults to
   * {@link DEFAULT_EXIT_OFFER} when unset.
   */
  "checkout.exit_offer": {
    enabled: boolean;
    /** 1–100. Percentage off the subtotal. */
    percent: number;
    /** How long the minted coupon stays valid, in minutes. */
    minutes: number;
    /**
     * Minimum basket value that earns the offer (0 = every basket does).
     * Below it nothing is shown at all — the popup has nothing else to say.
     */
    minSubtotalFils: number;
  };
  /**
   * Recovery email for a checkout that was started and never paid for. Like the
   * exit offer the discount lands on the item subtotal only. Defaults to
   * {@link DEFAULT_ABANDONED_EMAIL} (disabled) when unset.
   */
  "checkout.abandoned_email": {
    enabled: boolean;
    /** 0–100. Percent off to include; 0 sends a plain reminder with no code. */
    percent: number;
    /** How long after the checkout was abandoned to send, in minutes. */
    delayMinutes: number;
    /** How long the emailed code stays valid, in hours. */
    couponHours: number;
    /**
     * Minimum basket value that earns the discount (0 = every basket does).
     * Below it the reminder still goes out — just without a code, so a small
     * basket is still recovered without being discounted.
     */
    minSubtotalFils: number;
  };
};

/**
 * Read a stored object setting over its defaults.
 *
 * Settings are JSON blobs, so a row saved before a field existed is missing it
 * — and the readers would then compare against `undefined` (silently wrong) or
 * hand `undefined` to a formatter (a crash). Merging over the defaults means an
 * older row keeps working and simply gets the default for anything new.
 */
export function withDefaults<T extends object>(
  stored: unknown,
  defaults: T,
): T {
  if (!stored || typeof stored !== "object") return { ...defaults };
  return { ...defaults, ...(stored as Partial<T>) };
}

/** Fallback for `checkout.exit_offer` when the setting has never been saved. */
export const DEFAULT_EXIT_OFFER = {
  enabled: true,
  percent: 5,
  minutes: 15,
  minSubtotalFils: 0,
} as const;

/**
 * Fallback for `checkout.abandoned_email`. Ships **off**: it emails real
 * customers, so it waits for the shop owner to read the copy and switch it on
 * in Settings rather than starting the moment this deploys.
 */
export const DEFAULT_ABANDONED_EMAIL = {
  enabled: false,
  percent: 10,
  delayMinutes: 60,
  couponHours: 24,
  minSubtotalFils: 0,
} as const;

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
