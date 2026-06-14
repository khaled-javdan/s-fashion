"use client"

import { createContext, useContext, useMemo, useState } from "react"

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
