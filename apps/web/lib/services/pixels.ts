/**
 * Type-safe Meta Pixel + TikTok Pixel event helpers.
 *
 * Each event function fires the equivalent call on both `window.fbq`
 * (Meta) and `window.ttq` (TikTok) when those globals are present.
 *
 * All helpers are safe to call from server components — they early-return
 * when `window` is undefined. They also tolerate missing pixel globals
 * (e.g. when the user has declined cookie consent or an ad-blocker has
 * stripped the script), so callers can fire events unconditionally.
 *
 * The actual pixel <script> tags are mounted by
 * `components/analytics/meta-pixel.tsx` and `components/analytics/tiktok-pixel.tsx`,
 * which are only rendered when consent === "accept".
 *
 * Reference event names follow Meta's "standard events" and TikTok's
 * "standard events" lists. The mapping is one-to-one in v1.
 */

// ─── Global typings ──────────────────────────────────────────────────

type FbqMethod = "init" | "track" | "trackCustom" | "consent";

interface FbqQueue {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
}

type FbqFn = ((method: FbqMethod, ...args: unknown[]) => void) & FbqQueue;

type TtqMethod = "track" | "page" | "identify" | "instance" | "load";

interface TtqFn {
  (method: TtqMethod, ...args: unknown[]): void;
  track?: (event: string, params?: Record<string, unknown>) => void;
  page?: () => void;
}

declare global {
  interface Window {
    fbq?: FbqFn;
    ttq?: TtqFn;
  }
}

// ─── Event payloads (typed) ──────────────────────────────────────────

export interface ViewContentPayload {
  productId: string;
  /** Total value in AED (not fils), to match the conventions Meta/TikTok expect. */
  value: number;
}

export interface AddToCartPayload {
  productId: string;
  value: number;
}

export interface InitiateCheckoutPayload {
  value: number;
}

export interface PurchasePayload {
  orderId: string;
  value: number;
}

const CURRENCY = "AED";

// ─── Public event helpers ────────────────────────────────────────────

export function viewContent(payload: ViewContentPayload): void {
  fireMeta("ViewContent", {
    content_ids: [payload.productId],
    content_type: "product",
    value: payload.value,
    currency: CURRENCY,
  });
  fireTikTok("ViewContent", {
    content_id: payload.productId,
    value: payload.value,
    currency: CURRENCY,
  });
}

export function addToCart(payload: AddToCartPayload): void {
  fireMeta("AddToCart", {
    content_ids: [payload.productId],
    content_type: "product",
    value: payload.value,
    currency: CURRENCY,
  });
  fireTikTok("AddToCart", {
    content_id: payload.productId,
    value: payload.value,
    currency: CURRENCY,
  });
}

export function initiateCheckout(payload: InitiateCheckoutPayload): void {
  fireMeta("InitiateCheckout", {
    value: payload.value,
    currency: CURRENCY,
  });
  fireTikTok("InitiateCheckout", {
    value: payload.value,
    currency: CURRENCY,
  });
}

export function purchase(payload: PurchasePayload): void {
  fireMeta("Purchase", {
    value: payload.value,
    currency: CURRENCY,
    order_id: payload.orderId,
  });
  fireTikTok("CompletePayment", {
    value: payload.value,
    currency: CURRENCY,
    order_id: payload.orderId,
  });
}

// ─── Internals ───────────────────────────────────────────────────────

function fireMeta(event: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("track", event, params);
  } catch (err) {
    console.warn("[pixels.meta]", event, err);
  }
}

function fireTikTok(event: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const ttq = window.ttq;
  if (!ttq) return;
  try {
    if (typeof ttq.track === "function") {
      ttq.track(event, params);
    } else if (typeof ttq === "function") {
      ttq("track", event, params);
    }
  } catch (err) {
    console.warn("[pixels.tiktok]", event, err);
  }
}
