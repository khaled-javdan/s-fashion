"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import {
  desktopColsClass,
  mobileColsClass,
  tabletColsClass,
  DESKTOP_TOGGLE_COLS,
  type GridConfig,
} from "@/lib/grid-config"

// Density preferences are namespaced per `storageScope` so that, e.g., changing
// the columns on the products listing page does NOT bleed into the home page
// grid (they're separate surfaces with their own remembered choice).
const MOBILE_STORAGE_PREFIX = "shop-grid-density"
const DESKTOP_STORAGE_PREFIX = "shop-grid-desktop-density"

/**
 * Glyph that draws `count` vertical bars in a 24×24 box, so the icon itself
 * communicates the column density (more bars = more columns). Scales to any
 * count, which lucide's `columns-*` set does not (it stops at 4).
 */
function ColumnsGlyph({ count }: { count: number }) {
  const gap = 2
  const barWidth = (24 - gap * (count + 1)) / count
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
    >
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={gap + i * (barWidth + gap)}
          y={4}
          width={barWidth}
          height={16}
          rx={1}
        />
      ))}
    </svg>
  )
}

/**
 * Renders the product grid with admin-configured columns per breakpoint, plus
 * shopper density toggles remembered locally:
 *  - mobile (1 vs 2 columns), always shown on small screens.
 *  - desktop (2–5 columns), shown on large screens only when `desktopToggle`
 *    is set (e.g. the products listing page).
 * `children` are the server-rendered `<li>` cards.
 */
export function ProductGrid({
  config,
  children,
  desktopToggle = false,
  storageScope = "shop",
  viewToggle,
}: {
  config: GridConfig
  children: React.ReactNode
  /** Show the desktop column toggle (2–5). Off by default (e.g. home page). */
  desktopToggle?: boolean
  /**
   * Namespace for the remembered density choice. Surfaces with different scopes
   * keep independent preferences (e.g. "home" vs "products") so a toggle on one
   * page doesn't change the grid on another.
   */
  storageScope?: string
  /** Optional view-mode toggle rendered to the start (left) of the toolbar. */
  viewToggle?: React.ReactNode
}) {
  const t = useTranslations("home")
  const mobileKey = `${MOBILE_STORAGE_PREFIX}:${storageScope}`
  const desktopKey = `${DESKTOP_STORAGE_PREFIX}:${storageScope}`
  // null → follow the admin default; otherwise the shopper's choice.
  const [mobile, setMobile] = useState<number | null>(null)
  const [desktop, setDesktop] = useState<number | null>(null)

  useEffect(() => {
    const savedMobile = window.localStorage.getItem(mobileKey)
    const savedDesktop = window.localStorage.getItem(desktopKey)
    // Hydrate the shopper's saved choices from localStorage on mount (external store).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedMobile === "1" || savedMobile === "2") setMobile(Number(savedMobile))
    const desktopNum = Number(savedDesktop)
    if (
      savedDesktop &&
      (DESKTOP_TOGGLE_COLS as readonly number[]).includes(desktopNum)
    ) {
      setDesktop(desktopNum)
    }
  }, [mobileKey, desktopKey])

  const chooseMobile = (n: number) => {
    setMobile(n)
    window.localStorage.setItem(mobileKey, String(n))
  }

  const chooseDesktop = (n: number) => {
    setDesktop(n)
    window.localStorage.setItem(desktopKey, String(n))
  }

  const mobileCols = mobile ?? config.mobile
  const desktopCols = desktop ?? config.desktop

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        {/* View-mode toggle (e.g. products vs styles) — always visible when present. */}
        {viewToggle ?? <span />}

        <div
          className={cn(
            "flex gap-2",
            // Mobile toggle shows < sm; desktop toggle (when enabled) shows >= lg.
            // Hide the density controls in the tablet band where neither applies.
            desktopToggle ? "sm:hidden lg:flex" : "sm:hidden",
          )}
        >
          {/* Mobile density: 1 vs 2 columns. */}
          <div
            role="group"
            aria-label={t("density_label")}
            className="border-border inline-flex overflow-hidden rounded-md border sm:hidden"
          >
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => chooseMobile(n)}
                aria-pressed={mobileCols === n}
                aria-label={t("density_option", { count: n })}
                className={cn(
                  "grid size-9 place-items-center transition-colors",
                  mobileCols === n
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <ColumnsGlyph count={n} />
              </button>
            ))}
          </div>

          {/* Desktop density: 2–5 columns (products page only). */}
          {desktopToggle && (
            <div
              role="group"
              aria-label={t("density_label")}
              className="border-border hidden overflow-hidden rounded-md border lg:inline-flex"
            >
              {DESKTOP_TOGGLE_COLS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => chooseDesktop(n)}
                  aria-pressed={desktopCols === n}
                  aria-label={t("density_option", { count: n })}
                  className={cn(
                    "grid size-9 place-items-center transition-colors",
                    desktopCols === n
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <ColumnsGlyph count={n} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul
        className={cn(
          "grid gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12",
          mobileColsClass(mobileCols),
          tabletColsClass(config.tablet),
          desktopColsClass(desktopCols),
        )}
      >
        {children}
      </ul>
    </>
  )
}
