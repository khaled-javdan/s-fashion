import type { Emirate } from "@workspace/db"

/**
 * Client-safe Emirate values — a literal list so we never import the runtime
 * `Emirate` enum from `@workspace/db`, which would pull the Prisma client (and
 * thus `node:fs`) into the browser bundle. Mirrors the `SIZE_VALUES` pattern in
 * the variants editor.
 */
export const EMIRATE_VALUES = [
  "ABU_DHABI",
  "DUBAI",
  "SHARJAH",
  "AJMAN",
  "UMM_AL_QUWAIN",
  "RAS_AL_KHAIMAH",
  "FUJAIRAH",
] as const satisfies readonly Emirate[]

/** English display labels for the Emirate enum (admin is English-only). */
const EMIRATE_LABELS: Record<Emirate, string> = {
  ABU_DHABI: "Abu Dhabi",
  DUBAI: "Dubai",
  SHARJAH: "Sharjah",
  AJMAN: "Ajman",
  UMM_AL_QUWAIN: "Umm Al Quwain",
  RAS_AL_KHAIMAH: "Ras Al Khaimah",
  FUJAIRAH: "Fujairah",
}

export function formatEmirate(emirate: Emirate | null | undefined): string {
  return emirate ? EMIRATE_LABELS[emirate] : ""
}

/** English country names for the supported GCC markets (admin is English-only). */
const COUNTRY_LABELS: Record<string, string> = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  KW: "Kuwait",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
}

export function formatCountry(country: string | null | undefined): string {
  if (!country) return ""
  return COUNTRY_LABELS[country] ?? country
}

/**
 * Human-readable destination: "Dubai, United Arab Emirates" for UAE orders
 * (with an emirate), or just the country name for other markets.
 */
export function formatDestination(
  country: string | null | undefined,
  emirate: Emirate | null | undefined,
): string {
  return [formatEmirate(emirate), formatCountry(country)]
    .filter(Boolean)
    .join(", ")
}
