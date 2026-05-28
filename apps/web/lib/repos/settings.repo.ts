import { prisma, Prisma } from "@workspace/db";
import type { Setting } from "@workspace/db";

/**
 * Known settings registry — keep in sync with the seed file and SPEC §4.
 * Each entry maps a key to its TypeScript shape; getSetting overloads use these.
 */
export type KnownSettings = {
  "shipping.flat_fils": number;
  "shipping.free_threshold_fils": number;
  "contact.whatsapp_number": string;
  "contact.business_hours_ar": string;
  "contact.business_hours_en": string;
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

/** Returns all settings as a key → value map (raw JSON values). */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany();
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    out[row.key] = row.value;
  }
  return out;
}
