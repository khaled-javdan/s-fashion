"use client"

import { Square, Columns2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import {
  desktopColsClass,
  mobileColsClass,
  tabletColsClass,
  type GridConfig,
} from "@/lib/grid-config"

const STORAGE_KEY = "shop-grid-density"

/**
 * Renders the product grid with admin-configured columns per breakpoint, plus a
 * shopper density toggle (1 vs 2 columns) on mobile that's remembered locally.
 * `children` are the server-rendered `<li>` cards.
 */
export function ProductGrid({
  config,
  children,
}: {
  config: GridConfig
  children: React.ReactNode
}) {
  const t = useTranslations("home")
  // null → follow the admin default; otherwise the shopper's mobile choice.
  const [mobile, setMobile] = useState<number | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    // Hydrate the shopper's saved choice from localStorage on mount (external store).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "1" || saved === "2") setMobile(Number(saved))
  }, [])

  const choose = (n: number) => {
    setMobile(n)
    window.localStorage.setItem(STORAGE_KEY, String(n))
  }

  const mobileCols = mobile ?? config.mobile

  return (
    <>
      <div className="mb-4 flex justify-end sm:hidden">
        <div
          role="group"
          aria-label={t("density_label")}
          className="border-border inline-flex overflow-hidden rounded-md border"
        >
          {[1, 2].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => choose(n)}
              aria-pressed={mobileCols === n}
              aria-label={t("density_option", { count: n })}
              className={cn(
                "grid size-9 place-items-center transition-colors",
                mobileCols === n
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {n === 1 ? (
                <Square className="size-4" />
              ) : (
                <Columns2 className="size-4" />
              )}
            </button>
          ))}
        </div>
      </div>

      <ul
        className={cn(
          "grid gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12",
          mobileColsClass(mobileCols),
          tabletColsClass(config.tablet),
          desktopColsClass(config.desktop),
        )}
      >
        {children}
      </ul>
    </>
  )
}
