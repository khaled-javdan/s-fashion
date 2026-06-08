"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

import type { Locale } from "@/lib/locale"
import type { CartItem } from "@/lib/cart-store"

import { AddToCartButton } from "./add-to-cart-button"
import { ColorSwatch } from "./color-swatch"
import { useProductColor } from "./product-color-context"
import { QuantityStepper } from "./quantity-stepper"
import { SizeSelector, type SizeOption } from "./size-selector"
import { StickyPdpCta } from "./sticky-pdp-cta"
import { StockBadge } from "./stock-badge"

/** Serializable variant shape passed from the PDP server component. */
export type PickerVariant = {
  id: string
  colorHex: string | null
  colorNameAr: string | null
  colorNameEn: string | null
  size: string
  stock: number
}

export type PickerProductImage = {
  url: string
  colorHex: string | null
}

export type PickerProduct = {
  productId: string
  slug: string
  nameAr: string
  nameEn: string
  priceFils: number
  /** Compare-at ("was") price in fils, or `null` when not on sale. */
  compareAtFils: number | null
  /** Shipping weight in grams (0 when unset); snapshotted onto the cart line. */
  weightGrams: number
  isFinalSale: boolean
  /** All product images, in display order. The first is the default fallback. */
  images: PickerProductImage[]
}

type Props = {
  product: PickerProduct
  variants: PickerVariant[]
  locale: Locale
  maxQtyPerVariant: number
}

/** A color group keyed by a stable identifier (hex or a sentinel). */
type ColorGroup = {
  key: string
  colorHex: string | null
  label: string
  /** Sizes available (stock > 0) for this color. */
  inStock: boolean
}

const NO_COLOR = "__no_color__"

function colorKey(v: PickerVariant): string {
  return v.colorHex ?? NO_COLOR
}

/**
 * Colocates color + size selection. Derives in-stock combinations from the full
 * variants array, disables out-of-stock options, auto-selects the sole color of
 * a uniquely-available size, and surfaces the chosen variant to `AddToCartButton`.
 */
export function VariantPicker({
  product,
  variants,
  locale,
  maxQtyPerVariant,
}: Props) {
  const t = useTranslations("product")

  const colorLabel = (v: PickerVariant): string => {
    const name = locale === "ar" ? v.colorNameAr : v.colorNameEn
    return name ?? v.colorNameEn ?? v.colorNameAr ?? ""
  }

  // Distinct colors, preserving first-seen order.
  const colors = useMemo<ColorGroup[]>(() => {
    const seen = new Map<string, ColorGroup>()
    for (const v of variants) {
      const key = colorKey(v)
      const existing = seen.get(key)
      const inStock = v.stock > 0
      if (existing) {
        existing.inStock = existing.inStock || inStock
      } else {
        seen.set(key, {
          key,
          colorHex: v.colorHex,
          label: colorLabel(v),
          inStock,
        })
      }
    }
    return [...seen.values()]
    // colorLabel depends on locale; variants is stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, locale])

  const singleColor = colors.length <= 1

  // Pre-select the first color for every product (not just single-color ones)
  // so the gallery opens on that color's photo by default. The shopper can still
  // switch colors freely.
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colors[0]?.key ?? null,
  )
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  // Publish the chosen color so the gallery can switch to its photo. Covers
  // every path that changes the color (swatch click, size auto-select, the
  // single-color default).
  const colorCtx = useProductColor()
  const selectColor = colorCtx?.selectColor
  useEffect(() => {
    selectColor?.(
      selectedColor && selectedColor !== NO_COLOR ? selectedColor : null,
    )
  }, [selectColor, selectedColor])

  // Gallery → picker: when the gallery swipes to an image with a different
  // colorHex, the context updates and we sync the local swatch selection here.
  useEffect(() => {
    const ctxHex = colorCtx?.selectedColorHex
    if (!ctxHex) return
    const match = colors.find((c) => c.colorHex === ctxHex)
    if (match) setSelectedColor(match.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorCtx?.selectedColorHex])

  // Sizes for the current color (or, with no color chosen, sizes in stock for
  // any color). Sizes are always shown in a stable order across colors, with
  // out-of-stock-for-this-color sizes marked unavailable rather than removed.
  const sizeOptions = useMemo<SizeOption[]>(() => {
    const stockBySize = new Map<string, number>()
    const allSizes: string[] = []
    for (const v of variants) {
      if (!allSizes.includes(v.size)) allSizes.push(v.size)
      if (selectedColor && colorKey(v) !== selectedColor) continue
      stockBySize.set(v.size, (stockBySize.get(v.size) ?? 0) + v.stock)
    }
    return allSizes.map((size) => ({
      size,
      available: (stockBySize.get(size) ?? 0) > 0,
    }))
  }, [variants, selectedColor])

  function handleSelectSize(size: string) {
    setSelectedSize(size)
    setQuantity(1)
    // If this size is available in exactly one color, auto-select it.
    if (!selectedColor) {
      const colorsForSize = new Set(
        variants
          .filter((v) => v.size === size && v.stock > 0)
          .map((v) => colorKey(v)),
      )
      if (colorsForSize.size === 1) {
        setSelectedColor([...colorsForSize][0]!)
      }
    }
  }

  function handleSelectColor(key: string) {
    setSelectedColor(key)
    setQuantity(1)
    // Clear size if it's no longer in stock for the new color.
    if (selectedSize) {
      const stillAvailable = variants.some(
        (v) => colorKey(v) === key && v.size === selectedSize && v.stock > 0,
      )
      if (!stillAvailable) setSelectedSize(null)
    }
  }

  // Resolve the currently-selected variant.
  const selectedVariant = useMemo<PickerVariant | null>(() => {
    if (!selectedColor || !selectedSize) return null
    return (
      variants.find(
        (v) => colorKey(v) === selectedColor && v.size === selectedSize,
      ) ?? null
    )
  }, [variants, selectedColor, selectedSize])

  const selectedStock = selectedVariant?.stock ?? 0
  const maxQty = Math.max(1, Math.min(maxQtyPerVariant, selectedStock || 1))

  const cartItem: CartItem | null = useMemo(() => {
    if (!selectedVariant || selectedVariant.stock <= 0) return null
    // Match the gallery's logic: prefer the first image tagged with the chosen
    // color, fall back to the first product image.
    const variantImage =
      (selectedVariant.colorHex
        ? product.images.find((img) => img.colorHex === selectedVariant.colorHex)
        : null) ?? product.images[0]
    return {
      variantId: selectedVariant.id,
      productId: product.productId,
      slug: product.slug,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      colorNameAr: selectedVariant.colorNameAr,
      colorNameEn: selectedVariant.colorNameEn,
      colorHex: selectedVariant.colorHex,
      size: selectedVariant.size,
      imageUrl: variantImage?.url ?? null,
      unitPriceFils: product.priceFils,
      compareAtFils: product.compareAtFils,
      weightGrams: product.weightGrams,
      isFinalSale: product.isFinalSale,
      quantity: Math.min(quantity, maxQty),
    }
  }, [selectedVariant, product, quantity, maxQty])

  const soleColor = colors[0]

  return (
    <div className="flex flex-col gap-6">
      {/* Color */}
      {singleColor ? (
        soleColor && soleColor.label ? (
          <p className="text-sm">
            {t("single_color_label", { color: soleColor.label })}
          </p>
        ) : null
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{t("select_color")}</span>
            {selectedColor && selectedColor !== NO_COLOR && (
              <>
                <span className="text-muted-foreground/50 text-sm">·</span>
                <span className="text-muted-foreground text-sm">
                  {colors.find((c) => c.key === selectedColor)?.label}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {colors.map((color) => (
              <ColorSwatch
                key={color.key}
                colorHex={color.colorHex}
                label={color.label}
                selected={selectedColor === color.key}
                disabled={!color.inStock}
                onSelect={() => handleSelectColor(color.key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Size */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("select_size")}</span>
        <SizeSelector
          options={sizeOptions}
          selected={selectedSize}
          onSelect={handleSelectSize}
        />
      </div>

      {/* Stock indicator (reactive to selection) */}
      <div aria-live="polite">
        {selectedVariant ? (
          <StockBadge
            stock={selectedStock}
            labels={{
              inStock: t("in_stock"),
              lowStock: t("low_stock"),
              outOfStock: t("out_of_stock"),
            }}
          />
        ) : (
          <span className="text-muted-foreground text-sm">
            {selectedColor ? t("select_size_first") : t("select_color_first")}
          </span>
        )}
      </div>

      {/* Quantity */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("quantity_label")}</span>
        <QuantityStepper
          value={quantity}
          min={1}
          max={maxQty}
          disabled={!selectedVariant || selectedStock <= 0}
          onChange={setQuantity}
        />
      </div>

      {/* Add to cart (inline) */}
      <AddToCartButton item={cartItem} locale={locale} className="w-full" />

      {/* Mobile-only sticky bar mirroring the inline button */}
      <StickyPdpCta item={cartItem} priceFils={product.priceFils} locale={locale} />
    </div>
  )
}
