"use client"

import { useEffect } from "react"

/**
 * Triggers the browser print dialog once after mount. Rendered on the
 * standalone print page so opening it (in a new tab) immediately offers print.
 */
export function AutoPrint() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [])

  return null
}
