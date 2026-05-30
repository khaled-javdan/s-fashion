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

export function formatEmirate(emirate: Emirate): string {
  return EMIRATE_LABELS[emirate]
}
