"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

/**
 * Shares the PDP's currently-selected color between the variant picker (which
 * owns color/size selection) and the gallery (which jumps to that color's first
 * photo). Kept deliberately tiny — just the selected hex and a setter — so the
 * two sibling client components in separate layout columns can coordinate.
 */
type ProductColorValue = {
  selectedColorHex: string | null
  selectColor: (hex: string | null) => void
}

const ProductColorContext = createContext<ProductColorValue | null>(null)

export function ProductColorProvider({
  children,
  initialColorHex,
}: {
  children: React.ReactNode
  initialColorHex?: string | null
}) {
  const [selectedColorHex, setSelectedColorHex] = useState<string | null>(
    initialColorHex ?? null,
  )

  // Keep the URL's `?color=` in sync with the selection so the address bar can
  // be copied to share a link that opens on this exact color. Uses
  // history.replaceState (Next's supported shallow-update path) to update the
  // URL without a navigation or server refetch. Every color change — swatch
  // click, gallery swipe, default auto-select — flows through this state, so
  // this single effect covers them all.
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (selectedColorHex) {
      if (url.searchParams.get("color") === selectedColorHex) return
      url.searchParams.set("color", selectedColorHex)
    } else {
      if (!url.searchParams.has("color")) return
      url.searchParams.delete("color")
    }
    window.history.replaceState(window.history.state, "", url)
  }, [selectedColorHex])

  const value = useMemo(
    () => ({ selectedColorHex, selectColor: setSelectedColorHex }),
    [selectedColorHex],
  )
  return (
    <ProductColorContext.Provider value={value}>
      {children}
    </ProductColorContext.Provider>
  )
}

/** Returns the shared color state, or null when used outside a provider. */
export function useProductColor(): ProductColorValue | null {
  return useContext(ProductColorContext)
}
