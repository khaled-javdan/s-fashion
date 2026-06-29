"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Admin content-width toggle. Lets an admin shrink the page to a centered
 * reading column or expand it to the full viewport — applied uniformly to
 * every admin page (including Settings). The choice is persisted in a cookie so
 * the server renders the correct width on the next navigation with no flash.
 */

const COOKIE = "admin_content_expanded"

type Ctx = { expanded: boolean; toggle: () => void }

const AdminContentWidthContext = React.createContext<Ctx | null>(null)

export function AdminContentWidthProvider({
  initialExpanded,
  children,
}: {
  initialExpanded: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = React.useState(initialExpanded)

  const toggle = React.useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      // Persist for SSR on the next request (1 year, same-site).
      document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }, [])

  const value = React.useMemo(() => ({ expanded, toggle }), [expanded, toggle])

  return (
    <AdminContentWidthContext.Provider value={value}>
      {children}
    </AdminContentWidthContext.Provider>
  )
}

export function useAdminContentWidth(): Ctx {
  const ctx = React.useContext(AdminContentWidthContext)
  if (!ctx) {
    throw new Error(
      "useAdminContentWidth must be used within an AdminContentWidthProvider",
    )
  }
  return ctx
}

/**
 * The admin page container. Keeps full-bleed padding while constraining the
 * inner content to a readable column when collapsed, or the full width when
 * expanded.
 */
export function AdminContent({ children }: { children: React.ReactNode }) {
  const { expanded } = useAdminContentWidth()
  return (
    <main className="flex flex-1 flex-col p-6 pt-20">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6",
          expanded ? "max-w-none" : "max-w-5xl",
        )}
      >
        {children}
      </div>
    </main>
  )
}
