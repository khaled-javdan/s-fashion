import { z } from "zod"

/**
 * Storefront product-grid column counts per breakpoint.
 *
 * Stored as JSON under the `home.grid` setting and edited from the admin
 * settings page. The shopper can additionally override the mobile count with a
 * density toggle (see `ProductGrid`). Column classes are emitted as static
 * strings below so Tailwind's content scanner keeps them.
 */
export type GridConfig = {
  mobile: number
  tablet: number
  desktop: number
}

export const MOBILE_COLS = [1, 2] as const
export const TABLET_COLS = [2, 3, 4] as const
export const DESKTOP_COLS = [3, 4, 5] as const

export const DEFAULT_GRID: GridConfig = { mobile: 1, tablet: 3, desktop: 5 }

export const gridConfigSchema = z.object({
  mobile: z.number().int().min(1).max(2),
  tablet: z.number().int().min(2).max(4),
  desktop: z.number().int().min(3).max(5),
})

/** Parse a raw stored value into a GridConfig, falling back to defaults. */
export function parseGridConfig(raw: unknown): GridConfig {
  const result = gridConfigSchema.safeParse(raw)
  return result.success ? result.data : DEFAULT_GRID
}

// Static class strings (no interpolation) so Tailwind emits them.
const MOBILE_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
}
const TABLET_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
}
const DESKTOP_CLASS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
}

/**
 * Desktop column counts a shopper can pick via the grid toggle. Wider than the
 * admin range (`DESKTOP_COLS`, 3–5) on the low end so they can spread cards out.
 */
export const DESKTOP_TOGGLE_COLS = [2, 3, 4, 5] as const

export function mobileColsClass(n: number): string {
  return MOBILE_CLASS[n] ?? MOBILE_CLASS[DEFAULT_GRID.mobile]!
}
export function tabletColsClass(n: number): string {
  return TABLET_CLASS[n] ?? TABLET_CLASS[DEFAULT_GRID.tablet]!
}
export function desktopColsClass(n: number): string {
  return DESKTOP_CLASS[n] ?? DESKTOP_CLASS[DEFAULT_GRID.desktop]!
}

/** Full responsive `grid-cols-*` class string for a config. */
export function gridColsClass(cfg: GridConfig): string {
  return [
    mobileColsClass(cfg.mobile),
    tabletColsClass(cfg.tablet),
    desktopColsClass(cfg.desktop),
  ].join(" ")
}
