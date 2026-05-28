"use client"

import * as React from "react"

/**
 * Theme provider — Round 1, light-only.
 *
 * S Fashion v1 ships light-only (see SPEC.md §8 Track A: "Remove the `.dark`
 * block entirely"). This provider is kept as a thin passthrough so existing
 * imports (`@/components/theme-provider`) continue to work and we have a hook
 * point if a brand toggle is added later.
 */
function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export { ThemeProvider }
