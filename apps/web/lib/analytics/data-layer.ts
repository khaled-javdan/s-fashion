/**
 * GA4-standard ecommerce dataLayer helpers.
 *
 * We push GA4's recommended ecommerce events onto `window.dataLayer`; GTM owns
 * the fan-out to GA4 / Meta / TikTok / Google Ads (GTM-centralized model). The
 * GTM container itself is mounted in the public layout via
 * `@next/third-parties` `<GoogleTagManager>`, which seeds `window.dataLayer`.
 *
 * Conventions baked in here so call sites stay dumb:
 *
 *  - **Currency is always AED.** Prices are stored as integer *fils* (base
 *    AED); the storefront converts to the shopper's display currency for
 *    rendering only. Analytics values are kept in base AED so ad-platform
 *    reporting never mixes currencies. {@link toMajor} does the fils → AED
 *    major-unit conversion.
 *  - **`ecommerce` is cleared before every push** (`{ ecommerce: null }`),
 *    which is GA4's required pattern so a previous event's `items` can't bleed
 *    into the next one.
 *  - **`item_id`**: the conversion path (add_to_cart → begin_checkout →
 *    purchase) uses `variantId`, which every cart/order line carries natively.
 *    `view_item` is product-level (no variant selected yet) and uses
 *    `productId`.
 *
 * All helpers are SSR-safe (early-return when `window` is undefined) and never
 * throw, so call sites can fire them unconditionally.
 */

type DataLayerObject = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: DataLayerObject[]
  }
}

const CURRENCY = "AED"

/** A single GA4 ecommerce line item. */
type Ga4Item = {
  item_id: string
  item_name: string
  /** Unit price in AED major units. */
  price: number
  quantity: number
}

/** A cart/order line in the shape the conversion-path helpers consume. */
export type AnalyticsLine = {
  variantId: string
  nameEn: string
  unitPriceFils: number
  quantity: number
}

/** Convert integer fils (base AED) to AED major units, e.g. 29900 → 299. */
function toMajor(fils: number): number {
  return Math.round(fils) / 100
}

function lineToItem(line: AnalyticsLine): Ga4Item {
  return {
    item_id: line.variantId,
    item_name: line.nameEn,
    price: toMajor(line.unitPriceFils),
    quantity: line.quantity,
  }
}

function push(event: string, ecommerce: DataLayerObject): void {
  if (typeof window === "undefined") return
  try {
    window.dataLayer = window.dataLayer ?? []
    // GA4 requirement: null out the prior ecommerce object so items don't merge.
    window.dataLayer.push({ ecommerce: null })
    window.dataLayer.push({
      event,
      ecommerce: { currency: CURRENCY, ...ecommerce },
    })
  } catch (err) {
    // Analytics must never break the app.
    console.warn("[dataLayer]", event, err)
  }
}

// ─── Public event helpers ────────────────────────────────────────────

/** Product detail page view. Product-level: `item_id` is the productId. */
export function viewItem(p: {
  productId: string
  nameEn: string
  priceFils: number
}): void {
  push("view_item", {
    value: toMajor(p.priceFils),
    items: [
      {
        item_id: p.productId,
        item_name: p.nameEn,
        price: toMajor(p.priceFils),
        quantity: 1,
      },
    ],
  })
}

/** A single variant added to the cart. */
export function addToCart(line: AnalyticsLine): void {
  push("add_to_cart", {
    value: toMajor(line.unitPriceFils * line.quantity),
    items: [lineToItem(line)],
  })
}

/** Checkout started, with the full cart. `value` is the cart subtotal in AED. */
export function beginCheckout(p: {
  lines: AnalyticsLine[]
  subtotalFils: number
}): void {
  push("begin_checkout", {
    value: toMajor(p.subtotalFils),
    items: p.lines.map(lineToItem),
  })
}

/**
 * Completed order. `value` is the authoritative order total (incl. shipping,
 * net of discount) the customer paid, in AED. `transaction_id` is the order
 * number — GA4 uses it to de-duplicate purchases server-side.
 */
export function purchase(p: {
  orderNumber: string
  totalFils: number
  shippingFils: number
  lines: AnalyticsLine[]
}): void {
  push("purchase", {
    transaction_id: p.orderNumber,
    value: toMajor(p.totalFils),
    shipping: toMajor(p.shippingFils),
    items: p.lines.map(lineToItem),
  })
}
