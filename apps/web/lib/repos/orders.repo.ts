import { prisma, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@workspace/db";
import type { Order, OrderItem, OrderEvent } from "@workspace/db";
import { generateOrderNumber } from "@/lib/order-number";
import { upsertCustomerForOrder } from "@/lib/repos/customers.repo";
import {
  CouponExhaustedError,
  recordCouponRedemption,
} from "@/lib/repos/coupons.repo";
import {
  decrementVariantStock,
  InsufficientStockError,
} from "@/lib/repos/products.repo";
import type { OrderCreateInput, OrderItemInput } from "@/lib/schemas/order.schema";

export type OrderWithItems = Order & { items: OrderItem[] };
/** OrderItem enriched with a resolved product thumbnail and color swatch. */
export type OrderItemWithImage = OrderItem & {
  imageUrl: string | null
  colorHex: string | null
}
/** Full order with image-enriched items (admin detail view). */
export type OrderWithItemsAndEvents = Order & {
  items: OrderItemWithImage[];
  events: OrderEvent[];
};
/** Full order with plain items + events (customer-facing tracking). */
export type OrderWithItemsAndEventsBasic = Order & {
  items: OrderItem[];
  events: OrderEvent[];
};

/** Resolved variant info used to snapshot an order item. */
export type ResolvedOrderItem = OrderItemInput & {
  productNameAr: string;
  productNameEn: string;
  colorNameAr: string | null;
  colorNameEn: string | null;
  size: OrderItem["size"];
  unitPriceFils: number;
  /** Unit cost snapshot at order time (fils); 0 when the product has no cost. */
  unitCostFils: number;
};

export type CreateOrderInput = Omit<OrderCreateInput, "items" | "couponCode"> & {
  subtotalFils: number;
  shippingFils: number;
  totalFils: number;
  /** Coupon discount applied (server-recomputed fils); 0 when no coupon. */
  discountFils: number;
  /** Stored coupon code snapshot (display); null when no coupon. */
  couponCode?: string | null;
  /** Coupon id to link + redeem; null when no coupon. */
  couponId?: string | null;
  /** Currency the customer saw + the AED→currency rate at order time. */
  displayCurrency: string;
  fxRate: number;
  /**
   * Initial status. Defaults to NEW (COD). Stripe orders are born
   * AWAITING_PAYMENT with stock reserved and promoted to NEW on payment.
   */
  status?: OrderStatus;
  /** Defaults to COD. */
  paymentMethod?: PaymentMethod;
  /** null for COD; PENDING for Stripe orders awaiting payment. */
  paymentStatus?: PaymentStatus | null;
};

/**
 * Whether an error is a unique-constraint violation on `Order.orderNumber`.
 * `generateOrderNumber` derives the suffix from a count, so two concurrent
 * checkouts can race to the same number under READ COMMITTED; the @unique index
 * is the authoritative guard and we retry the transaction when it fires.
 */
function isOrderNumberCollision(err: unknown): boolean {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const target = err.meta?.target;
    if (Array.isArray(target)) return target.includes("orderNumber");
    if (typeof target === "string") return target.includes("orderNumber");
    // Order creation has no other unique column that can collide, so treat an
    // unknown-target P2002 as an order-number race worth retrying.
    return true;
  }
  return false;
}

/**
 * Create an order atomically. The phone has already been OTP-verified before
 * this is called, so the order is born `NEW` + `phoneVerified` (no fragile
 * second write). In one transaction:
 *   1. Reserve stock (decrementVariantStock).
 *   2. Upsert + link the customer (records marketing consent).
 *   3. Generate the order number from the in-transaction count.
 *   4. Insert order + snapshot items + initial status_change event.
 *
 * Throws `InsufficientStockError` if any variant has insufficient stock; the
 * entire transaction is rolled back in that case. Retries up to 3× on an
 * order-number collision.
 */
export async function createOrder(
  input: CreateOrderInput,
  items: ResolvedOrderItem[],
): Promise<{ id: string; orderNumber: string }> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Reserve stock for every line item up-front. Any failure aborts the tx.
        for (const item of items) {
          await decrementVariantStock(item.variantId, item.quantity, tx);
        }

        // 2. Upsert the customer behind this order (phone is verified) and keep
        //    the id so the order links to it. Records marketing consent.
        const customerId = await upsertCustomerForOrder(
          {
            phone: input.phone,
            name: input.customerName,
            email: input.email ?? null,
            locale: input.locale,
            country: input.country,
            emirate: input.emirate ?? null,
            city: input.city,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2 ?? null,
            marketingConsent: input.marketingConsent ?? false,
          },
          tx,
        );

        // 3. Derive a fresh order number inside the transaction.
        const orderNumber = await generateOrderNumber(tx);

        // 4. Insert the order with snapshot items.
        const initialStatus = input.status ?? OrderStatus.NEW;
        const order = await tx.order.create({
          data: {
            orderNumber,
            status: initialStatus,
            paymentMethod: input.paymentMethod ?? PaymentMethod.COD,
            paymentStatus: input.paymentStatus ?? null,
            customer: { connect: { id: customerId } },
            customerName: input.customerName,
            phone: input.phone,
            phoneVerified: true,
            email: input.email ?? null,
            country: input.country,
            emirate: input.emirate ?? null,
            city: input.city,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2 ?? null,
            notes: input.notes ?? null,
            subtotalFils: input.subtotalFils,
            shippingFils: input.shippingFils,
            totalFils: input.totalFils,
            discountFils: input.discountFils,
            couponCode: input.couponCode ?? null,
            ...(input.couponId
              ? { coupon: { connect: { id: input.couponId } } }
              : {}),
            displayCurrency: input.displayCurrency,
            fxRate: input.fxRate,
            locale: input.locale,
            items: {
              create: items.map((item) => ({
                variantId: item.variantId,
                productNameAr: item.productNameAr,
                productNameEn: item.productNameEn,
                colorNameAr: item.colorNameAr,
                colorNameEn: item.colorNameEn,
                size: item.size,
                unitPriceFils: item.unitPriceFils,
                unitCostFils: item.unitCostFils,
                quantity: item.quantity,
              })),
            },
            events: {
              create: {
                type: "status_change",
                payload: { to: initialStatus },
                actorId: null,
              },
            },
          },
          select: { id: true, orderNumber: true },
        });

        // Redeem the coupon inside the same transaction so the global-cap guard
        // (CouponExhaustedError) rolls back the whole order — the discount the
        // customer is charged is exactly the one recorded as redeemed.
        if (input.couponId) {
          await recordCouponRedemption(
            { couponId: input.couponId, orderId: order.id, phone: input.phone },
            tx,
          );
        }

        return order;
      });
    } catch (err) {
      // Retry only on an order-number race; surface everything else immediately
      // (notably InsufficientStockError).
      if (isOrderNumberCollision(err) && attempt < MAX_ATTEMPTS - 1) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }

  throw lastErr ?? new Error("createOrder: exhausted order-number retries");
}

/** Re-export so callers handle the error without depending on products.repo. */
export { InsufficientStockError };
/** Re-export so callers handle a coupon-cap race without importing coupons.repo. */
export { CouponExhaustedError };

export async function getOrderById(
  id: string,
): Promise<OrderWithItemsAndEvents | null> {
  const row = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          variant: {
            select: {
              colorHex: true,
              product: {
                select: {
                  images: {
                    select: { url: true, colorHex: true },
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!row) return null;

  return {
    ...row,
    items: row.items.map(({ variant, ...item }) => {
      const images = variant?.product?.images ?? [];
      const colorHex = variant?.colorHex ?? null;
      // Prefer the image tagged with the variant's color; fall back to the
      // first product image.
      const imageUrl =
        (colorHex ? images.find((img) => img.colorHex === colorHex) : null)
          ?.url ??
        images[0]?.url ??
        null;
      return { ...item, imageUrl, colorHex } as OrderItemWithImage;
    }),
  };
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderWithItemsAndEventsBasic | null> {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * UTC instant for the start of "today" in the UAE (Asia/Dubai is a fixed
 * UTC+4 with no DST), so "orders today" lines up with the local business day
 * regardless of the server's timezone.
 */
function startOfTodayInUae(): Date {
  const OFFSET_MS = 4 * 60 * 60 * 1000;
  const nowUae = Date.now() + OFFSET_MS;
  const dayStartUae = Math.floor(nowUae / 86_400_000) * 86_400_000;
  return new Date(dayStartUae - OFFSET_MS);
}

export type DashboardOrderStats = {
  /** Verified orders placed since the start of today (UAE). */
  ordersToday: number;
  /** New orders awaiting confirmation. */
  pendingOrders: number;
};

/** Overview counts for the admin dashboard. */
export async function getDashboardOrderStats(): Promise<DashboardOrderStats> {
  const since = startOfTodayInUae();
  const [ordersToday, pendingOrders] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: { gte: since },
        status: {
          notIn: [
            OrderStatus.PENDING_VERIFICATION,
            OrderStatus.AWAITING_PAYMENT,
          ],
        },
      },
    }),
    prisma.order.count({ where: { status: OrderStatus.NEW } }),
  ]);
  return { ordersToday, pendingOrders };
}

// Statuses that count as real sales (placed + progressing through fulfilment).
export const SALES_STATUSES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

const UAE_OFFSET_MS = 4 * 60 * 60 * 1000;
/** Day bucket index for a date, in UAE local time (fixed UTC+4). */
function uaeDayKey(d: Date): number {
  return Math.floor((d.getTime() + UAE_OFFSET_MS) / 86_400_000);
}
/** `YYYY-MM-DD` (UAE calendar date) for a day-bucket index. */
function dayKeyToIso(key: number): string {
  const wall = new Date(key * 86_400_000); // read UTC fields = the UAE date
  const y = wall.getUTCFullYear();
  const m = String(wall.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wall.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type SalesDaily = {
  date: string;
  /** Gross sales (order totals incl. shipping) placed that day. */
  salesFils: number;
  /** Of those, totals from orders that have since been delivered (collected). */
  collectedFils: number;
  orders: number;
};
export type TopProduct = {
  productId: string;
  nameEn: string;
  nameAr: string;
  units: number;
  revenueFils: number;
};
/** Gross sales + order count for one payment method over the window. */
export type PaymentMethodTotals = {
  salesFils: number;
  orders: number;
};
export type SalesAnalytics = {
  /** Gross sales: sum of order totals (incl. shipping) for placed orders. */
  totalSalesFils: number;
  /** Net revenue: product value only (sum of subtotals, excludes shipping). */
  netRevenueFils: number;
  /** Collected: total of DELIVERED orders — money actually received (COD). */
  collectedFils: number;
  /** Total cost of goods sold (sum of unit-cost snapshots × quantity). */
  totalCostFils: number;
  /** Gross profit: net revenue (excl. shipping) − total cost of goods. */
  grossProfitFils: number;
  orders: number;
  aovFils: number;
  units: number;
  /**
   * Gross-sales split by how the customer paid. Card totals are money already
   * captured (Stripe orders only enter the sales window once PAID); COD totals
   * are still owed until the order is DELIVERED.
   */
  payment: {
    cod: PaymentMethodTotals;
    card: PaymentMethodTotals;
  };
  daily: SalesDaily[];
  topProducts: TopProduct[];
  /** Resolved window (UAE calendar dates, inclusive), echoed back for labels. */
  from: string;
  to: string;
};

export type AnalyticsRange = { days?: number; from?: string; to?: string };

/** `YYYY-MM-DD` (UAE date) → day-bucket index (inverse of dayKeyToIso). */
function isoToDayKey(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/**
 * Resolve an {@link AnalyticsRange} to a concrete UAE-calendar window: either
 * an explicit `from`/`to` (capped to 365 days, never beyond today) or the last
 * `days` (default 30). Returns the day-bucket bounds, the half-open UTC instant
 * range `[since, until)` for querying, and the inclusive ISO dates to echo back
 * for labels. Shared by every windowed analytics reader.
 */
function resolveAnalyticsWindow(range: AnalyticsRange): {
  startKey: number;
  endKey: number;
  since: Date;
  until: Date;
  fromIso: string;
  toIso: string;
} {
  const todayKey = uaeDayKey(new Date());
  let startKey: number;
  let endKey: number;
  if (range.from && range.to) {
    const a = isoToDayKey(range.from);
    const b = isoToDayKey(range.to);
    startKey = Math.min(a, b);
    endKey = Math.min(Math.max(a, b), todayKey); // never beyond today
    if (endKey - startKey > 365) startKey = endKey - 365; // cap window
  } else {
    const days = Math.min(Math.max(range.days ?? 30, 1), 365);
    endKey = todayKey;
    startKey = todayKey - (days - 1);
  }
  if (startKey > endKey) startKey = endKey;

  return {
    startKey,
    endKey,
    since: new Date(startKey * 86_400_000 - UAE_OFFSET_MS),
    until: new Date((endKey + 1) * 86_400_000 - UAE_OFFSET_MS), // exclusive
    fromIso: dayKeyToIso(startKey),
    toIso: dayKeyToIso(endKey),
  };
}

/**
 * Store analytics over a window — either the last `range.days` (UAE calendar
 * days, default 30) or an explicit `range.from`/`range.to` (`YYYY-MM-DD`):
 * gross sales, net revenue (excl. shipping), collected (delivered) revenue,
 * order count, AOV, units sold, a daily timeseries (sales vs collected,
 * zero-filled), and the top products by revenue. Counts only real sales
 * (excludes unverified / cancelled / refused). One DB read.
 */
export async function getSalesAnalytics(
  range: AnalyticsRange = {},
): Promise<SalesAnalytics> {
  const { startKey, endKey, since, until } = resolveAnalyticsWindow(range);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: SALES_STATUSES },
      createdAt: { gte: since, lt: until },
    },
    select: {
      createdAt: true,
      status: true,
      totalFils: true,
      subtotalFils: true,
      paymentMethod: true,
      items: {
        select: {
          quantity: true,
          unitPriceFils: true,
          unitCostFils: true,
          productNameEn: true,
          productNameAr: true,
          variant: { select: { productId: true } },
        },
      },
    },
  });

  // Zero-filled daily buckets for the whole window.
  const dailyMap = new Map<
    number,
    { salesFils: number; collectedFils: number; orders: number }
  >();
  for (let k = startKey; k <= endKey; k++) {
    dailyMap.set(k, { salesFils: 0, collectedFils: 0, orders: 0 });
  }

  const products = new Map<string, TopProduct>();
  let totalSalesFils = 0;
  let netRevenueFils = 0;
  let collectedFils = 0;
  let totalCostFils = 0;
  let units = 0;
  const payment = {
    cod: { salesFils: 0, orders: 0 },
    card: { salesFils: 0, orders: 0 },
  };

  for (const order of orders) {
    const delivered = order.status === OrderStatus.DELIVERED;
    totalSalesFils += order.totalFils;
    netRevenueFils += order.subtotalFils;
    if (delivered) collectedFils += order.totalFils;

    const byMethod =
      order.paymentMethod === PaymentMethod.STRIPE ? payment.card : payment.cod;
    byMethod.salesFils += order.totalFils;
    byMethod.orders += 1;

    const bucket = dailyMap.get(uaeDayKey(order.createdAt));
    if (bucket) {
      bucket.salesFils += order.totalFils;
      if (delivered) bucket.collectedFils += order.totalFils;
      bucket.orders += 1;
    }
    for (const item of order.items) {
      units += item.quantity;
      totalCostFils += item.unitCostFils * item.quantity;
      const pid = item.variant?.productId;
      if (!pid) continue;
      const existing =
        products.get(pid) ??
        {
          productId: pid,
          nameEn: item.productNameEn,
          nameAr: item.productNameAr,
          units: 0,
          revenueFils: 0,
        };
      existing.units += item.quantity;
      existing.revenueFils += item.unitPriceFils * item.quantity;
      products.set(pid, existing);
    }
  }

  const daily: SalesDaily[] = [];
  for (let k = startKey; k <= endKey; k++) {
    const b = dailyMap.get(k)!;
    daily.push({
      date: dayKeyToIso(k),
      salesFils: b.salesFils,
      collectedFils: b.collectedFils,
      orders: b.orders,
    });
  }

  const topProducts = [...products.values()]
    .sort((a, b) => b.revenueFils - a.revenueFils)
    .slice(0, 5);

  return {
    totalSalesFils,
    netRevenueFils,
    collectedFils,
    totalCostFils,
    grossProfitFils: netRevenueFils - totalCostFils,
    orders: orders.length,
    aovFils: orders.length > 0 ? Math.round(totalSalesFils / orders.length) : 0,
    units,
    payment,
    daily,
    topProducts,
    from: dayKeyToIso(startKey),
    to: dayKeyToIso(endKey),
  };
}

/** One colour + size sold within a product's performance row. */
export type ProductPerformanceVariant = {
  variantId: string;
  colorNameEn: string | null;
  colorNameAr: string | null;
  colorHex: string | null;
  size: string;
  /** Units sold (sum of quantities) for this variant specifically. */
  units: number;
};

/**
 * A product's sales performance over the window — one row per product,
 * pooling every colour + size sold under it (see `variants`).
 */
export type ProductPerformanceRow = {
  productId: string | null;
  nameEn: string;
  nameAr: string;
  /** Thumbnail URL (product's first image) when it still exists; else null. */
  imageUrl: string | null;
  /** Product slug present only when the product still exists. */
  slug: string | null;
  /** Whether the product is still live (active, per the catalogue). */
  isActive: boolean;
  /** Units sold across all variants (sum of quantities). */
  units: number;
  /** Distinct orders that included any variant of this product. */
  orders: number;
  /** Revenue (unit price × qty, excludes shipping), base AED fils. */
  revenueFils: number;
  /** Cost of goods sold for these units (base AED fils). */
  costFils: number;
  /** Gross profit = revenue − cost (base AED fils). */
  profitFils: number;
  /** Colour + size breakdown, sorted by units sold (descending). */
  variants: ProductPerformanceVariant[];
};

/** A live catalogue product that sold nothing in the window. */
export type ZeroSaleProduct = {
  productId: string;
  nameEn: string;
  nameAr: string;
  imageUrl: string | null;
  slug: string;
  /** Number of live (non-archived) variants under this product. */
  variantCount: number;
};

export type ProductPerformance = {
  rows: ProductPerformanceRow[];
  /**
   * Active products with zero sales in the window (dead stock for the period) —
   * not one of their variants sold. Rolled up to the product so a large
   * catalogue stays scannable. Capped to `zeroSalesLimit`; `zeroSalesCount` is
   * the true total.
   */
  zeroSales: ZeroSaleProduct[];
  zeroSalesCount: number;
  /** Totals across all variants in the window (for KPI cards). */
  totalUnits: number;
  totalRevenueFils: number;
  totalProfitFils: number;
  /** Number of distinct variants that sold at least one unit. */
  variantsSold: number;
  /** Resolved window (UAE calendar dates, inclusive), echoed for labels. */
  from: string;
  to: string;
};

/**
 * Per-product sales performance over a window — units sold, distinct orders,
 * revenue (excl. shipping), cost of goods, and gross profit per product, with
 * its colour + size variants pooled underneath (`variants`). Ordered by units
 * sold (descending). Counts only real sales (SALES_STATUSES: excludes
 * unverified / awaiting-payment / cancelled / refused), so an unpaid Stripe
 * order never inflates a product's numbers. Name/colour/size come from the
 * order-item snapshot (survive archival); image/slug/colourHex/active flag
 * are enriched from the live catalogue.
 */
export async function getProductPerformance(
  range: AnalyticsRange = {},
  limit = 100,
  zeroSalesLimit = 60,
): Promise<ProductPerformance> {
  const { since, until, fromIso, toIso } = resolveAnalyticsWindow(range);

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        status: { in: SALES_STATUSES },
        createdAt: { gte: since, lt: until },
      },
    },
    select: {
      orderId: true,
      variantId: true,
      quantity: true,
      unitPriceFils: true,
      unitCostFils: true,
      productNameEn: true,
      productNameAr: true,
      colorNameEn: true,
      colorNameAr: true,
      size: true,
    },
  });

  // Accumulate per variant first — `orderIds` tracks which orders included
  // this variant, needed later to dedupe orders at the product level.
  type VariantAcc = {
    variantId: string;
    nameEn: string;
    nameAr: string;
    colorNameEn: string | null;
    colorNameAr: string | null;
    size: string;
    units: number;
    revenueFils: number;
    costFils: number;
    orderIds: Set<string>;
  };
  const byVariant = new Map<string, VariantAcc>();
  let totalUnits = 0;
  let totalRevenueFils = 0;
  let totalCostFils = 0;

  for (const item of items) {
    const revenue = item.unitPriceFils * item.quantity;
    const cost = item.unitCostFils * item.quantity;
    totalUnits += item.quantity;
    totalRevenueFils += revenue;
    totalCostFils += cost;

    const acc =
      byVariant.get(item.variantId) ??
      {
        variantId: item.variantId,
        nameEn: item.productNameEn,
        nameAr: item.productNameAr,
        colorNameEn: item.colorNameEn,
        colorNameAr: item.colorNameAr,
        size: item.size,
        units: 0,
        revenueFils: 0,
        costFils: 0,
        orderIds: new Set<string>(),
      };
    acc.units += item.quantity;
    acc.revenueFils += revenue;
    acc.costFils += cost;
    acc.orderIds.add(item.orderId);
    byVariant.set(item.variantId, acc);
  }

  // Enrich every sold variant with colourHex, thumbnail, slug, and product id
  // from the catalogue (archived/deleted variants keep their order-item
  // snapshot but get nulls) — needed up front so variants can be grouped by
  // product before ranking.
  const liveVariants = await prisma.productVariant.findMany({
    where: { id: { in: [...byVariant.keys()] } },
    select: {
      id: true,
      colorHex: true,
      product: {
        select: {
          id: true,
          slug: true,
          isActive: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
  });
  const liveById = new Map(liveVariants.map((v) => [v.id, v]));

  // Group variants under their product — a deleted variant's product id is
  // unknown, so it falls back to its own name-keyed group.
  type ProductAcc = {
    productId: string | null;
    nameEn: string;
    nameAr: string;
    imageUrl: string | null;
    slug: string | null;
    isActive: boolean;
    units: number;
    revenueFils: number;
    costFils: number;
    orderIds: Set<string>;
    variants: ProductPerformanceVariant[];
  };
  const byProduct = new Map<string, ProductAcc>();

  for (const acc of byVariant.values()) {
    const live = liveById.get(acc.variantId);
    const key = live?.product.id ?? `deleted:${acc.nameEn}:${acc.nameAr}`;
    const product = byProduct.get(key) ?? {
      productId: live?.product.id ?? null,
      nameEn: acc.nameEn,
      nameAr: acc.nameAr,
      imageUrl: live?.product.images[0]?.url ?? null,
      slug: live?.product.slug ?? null,
      isActive: live?.product.isActive ?? false,
      units: 0,
      revenueFils: 0,
      costFils: 0,
      orderIds: new Set<string>(),
      variants: [],
    };
    product.units += acc.units;
    product.revenueFils += acc.revenueFils;
    product.costFils += acc.costFils;
    for (const orderId of acc.orderIds) product.orderIds.add(orderId);
    product.variants.push({
      variantId: acc.variantId,
      colorNameEn: acc.colorNameEn,
      colorNameAr: acc.colorNameAr,
      colorHex: live?.colorHex ?? null,
      size: acc.size,
      units: acc.units,
    });
    byProduct.set(key, product);
  }

  const rows: ProductPerformanceRow[] = [...byProduct.values()]
    .sort((a, b) => b.units - a.units)
    .slice(0, limit)
    .map((product) => ({
      productId: product.productId,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      imageUrl: product.imageUrl,
      slug: product.slug,
      isActive: product.isActive,
      units: product.units,
      orders: product.orderIds.size,
      revenueFils: product.revenueFils,
      costFils: product.costFils,
      profitFils: product.revenueFils - product.costFils,
      variants: product.variants.sort((a, b) => b.units - a.units),
    }));

  // Zero-sellers for the period, rolled up to the PRODUCT: active products
  // where not a single variant sold in the window (true dead stock, and far
  // shorter than a per-variant list for a large catalogue). `notIn: []`
  // (nothing sold) correctly yields every active product. Newest first, so
  // recently-added non-sellers surface. One count + one bounded page.
  const soldProductIds = [...byProduct.values()]
    .map((p) => p.productId)
    .filter((id): id is string => id !== null);
  const zeroWhere = { isActive: true, id: { notIn: soldProductIds } };
  const [zeroSalesCount, zeroSaleProducts] = await Promise.all([
    prisma.product.count({ where: zeroWhere }),
    prisma.product.findMany({
      where: zeroWhere,
      orderBy: { createdAt: "desc" },
      take: zeroSalesLimit,
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameAr: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        _count: { select: { variants: { where: { isArchived: false } } } },
      },
    }),
  ]);
  const zeroSales: ZeroSaleProduct[] = zeroSaleProducts.map((p) => ({
    productId: p.id,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    imageUrl: p.images[0]?.url ?? null,
    slug: p.slug,
    variantCount: p._count.variants,
  }));

  return {
    rows,
    zeroSales,
    zeroSalesCount,
    totalUnits,
    totalRevenueFils,
    totalProfitFils: totalRevenueFils - totalCostFils,
    variantsSold: byVariant.size,
    from: fromIso,
    to: toIso,
  };
}

/**
 * Order IDs whose notifications haven't all been delivered yet — i.e. the
 * Telegram owner alert is unstamped, or the customer has an email but the
 * confirmation is unstamped. Scoped to real (verified) orders placed within the
 * lookback window so the retry cron never resurrects ancient or abandoned
 * (PENDING_VERIFICATION) orders. Online orders are only eligible once PAID —
 * an unpaid or payment-expired Stripe order must never be notified, even
 * after it moves to CANCELLED. Newest first, capped to `take`.
 */
export async function listOrderIdsAwaitingNotification(
  lookbackHours = 24,
  take = 50,
): Promise<string[]> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const rows = await prisma.order.findMany({
    where: {
      status: {
        notIn: [
          OrderStatus.PENDING_VERIFICATION,
          OrderStatus.AWAITING_PAYMENT,
        ],
      },
      createdAt: { gte: since },
      AND: [
        {
          OR: [
            { paymentMethod: PaymentMethod.COD },
            { paymentStatus: PaymentStatus.PAID },
          ],
        },
      ],
      OR: [
        { adminNotifiedAt: null },
        { AND: [{ email: { not: null } }, { customerEmailedAt: null }] },
        // Phone is always set on verified orders, so no `email`-style gate.
        { customerSmsedAt: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type ListOrdersFilter = {
  status?: OrderStatus | OrderStatus[];
  phone?: string;
  fromDate?: Date;
  toDate?: Date;
  take?: number;
  skip?: number;
};

export async function listOrders(
  filter: ListOrdersFilter = {},
): Promise<OrderWithItems[]> {
  const where: Prisma.OrderWhereInput = {};

  if (filter.status) {
    where.status = Array.isArray(filter.status)
      ? { in: filter.status }
      : filter.status;
  }
  if (filter.phone) where.phone = filter.phone;
  if (filter.fromDate || filter.toDate) {
    where.createdAt = {
      ...(filter.fromDate ? { gte: filter.fromDate } : {}),
      ...(filter.toDate ? { lte: filter.toDate } : {}),
    };
  }

  return prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filter.take,
    skip: filter.skip,
    include: { items: true },
  });
}

/** Status → timestamp column mapping. */
const STATUS_TIMESTAMP: Partial<Record<OrderStatus, keyof Order>> = {
  [OrderStatus.CONFIRMED]: "confirmedAt",
  [OrderStatus.SHIPPED]: "shippedAt",
  [OrderStatus.DELIVERED]: "deliveredAt",
  [OrderStatus.CANCELLED]: "cancelledAt",
  [OrderStatus.REFUSED]: "cancelledAt",
};

/** Statuses that put inventory back. */
const RECREDIT_STATUSES = new Set<OrderStatus>([
  OrderStatus.CANCELLED,
  OrderStatus.REFUSED,
]);

/**
 * Move an order to a new status. Idempotent (no-op if already there) and
 * symmetric with respect to stock:
 * - Appends an OrderEvent of type "status_change".
 * - Sets the timestamp column corresponding to the target status.
 * - ENTERING a recredit status (CANCELLED/REFUSED) from a non-recredit one
 *   re-credits each line's stock (the goods go back on the shelf).
 * - LEAVING a recredit status back to a non-recredit one re-DEDUCTS each line's
 *   stock via {@link decrementVariantStock} — reversing a cancel/refusal pulls
 *   the goods back off the shelf. Throws {@link InsufficientStockError} (which
 *   rolls back the whole transaction) if anything sold out in the meantime, so
 *   the caller can surface a clear "can't un-cancel, out of stock" message.
 *
 * The recredit/redecrement only fire on a *crossing* of the recredit boundary,
 * so repeated moves within the same side never double-credit or double-deduct.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actorId: string | null,
  reason?: string,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    if (order.status === newStatus) {
      return order;
    }

    const data: Prisma.OrderUpdateInput = {
      status: newStatus,
      ...(reason ? { cancelReason: reason } : {}),
    };

    const tsCol = STATUS_TIMESTAMP[newStatus];
    if (tsCol) {
      (data as Record<string, unknown>)[tsCol] = new Date();
    }

    const enteringRecredit =
      RECREDIT_STATUSES.has(newStatus) && !RECREDIT_STATUSES.has(order.status);
    const leavingRecredit =
      !RECREDIT_STATUSES.has(newStatus) && RECREDIT_STATUSES.has(order.status);

    // Re-deduct BEFORE writing the new status: if any line is out of stock the
    // InsufficientStockError aborts the transaction and the order stays put.
    if (leavingRecredit) {
      for (const item of order.items) {
        await decrementVariantStock(item.variantId, item.quantity, tx);
      }
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data,
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        type: "status_change",
        payload: {
          from: order.status,
          to: newStatus,
          ...(reason ? { reason } : {}),
        },
        actorId,
      },
    });

    // Re-credit stock when crossing into a cancellation state for the first time.
    if (enteringRecredit) {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Stripe payment lifecycle
// ---------------------------------------------------------------------------

/** Attach the Stripe Checkout Session id right after the session is created. */
export async function setOrderStripeSession(
  orderId: string,
  sessionId: string,
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { stripeSessionId: sessionId },
  });
}

export type MarkPaidResult =
  | { outcome: "paid"; orderId: string; orderNumber: string }
  | { outcome: "already_paid"; orderId: string; orderNumber: string }
  /**
   * Payment landed after the order had been expired-cancelled AND its stock
   * has been resold in the meantime. Payment is recorded but the order stays
   * CANCELLED — the caller must alert the admin to refund in Stripe.
   */
  | { outcome: "paid_but_cancelled"; orderId: string; orderNumber: string }
  | { outcome: "not_found" };

/**
 * Record a successful Stripe payment. Idempotent — callable from the webhook,
 * the return-page reconcile, and the cron backstop in any order:
 * - Looks the order up by Checkout Session id, falling back to
 *   `fallbackOrderId` (webhook metadata) for the tiny window where the
 *   session id hasn't been persisted yet.
 * - Already PAID → no-op.
 * - AWAITING_PAYMENT → PAID + promoted to NEW (status_change event).
 * - CANCELLED (paid-after-expiry race; stock was re-credited) → re-reserves
 *   stock and promotes to NEW; if anything sold out in the meantime the
 *   payment is still recorded but the order stays CANCELLED
 *   (`paid_but_cancelled`).
 */
export async function markOrderPaidBySession(
  sessionId: string,
  paymentIntentId: string | null,
  fallbackOrderId?: string,
): Promise<MarkPaidResult> {
  return prisma.$transaction(async (tx) => {
    let order = await tx.order.findUnique({
      where: { stripeSessionId: sessionId },
      include: { items: true },
    });
    if (!order && fallbackOrderId) {
      order = await tx.order.findUnique({
        where: { id: fallbackOrderId },
        include: { items: true },
      });
      // Never cross-apply a payment to an order tied to a different session.
      if (order?.stripeSessionId && order.stripeSessionId !== sessionId) {
        order = null;
      }
    }
    if (!order) return { outcome: "not_found" };
    const ref = { orderId: order.id, orderNumber: order.orderNumber };

    if (order.paymentStatus === PaymentStatus.PAID) {
      return { outcome: "already_paid", ...ref };
    }

    const paidData: Prisma.OrderUpdateInput = {
      paymentStatus: PaymentStatus.PAID,
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      // Backfill for the fallback-lookup path.
      stripeSessionId: sessionId,
    };

    // Paid-after-expiry: the expiry path re-credited stock, so pull it back
    // off the shelf before reviving the order. decrementVariantStock uses a
    // conditional update (no DB error), so a failure is catchable in-tx; the
    // partial decrements are manually reverted to keep stock consistent.
    if (order.status === OrderStatus.CANCELLED) {
      const reserved: { variantId: string; quantity: number }[] = [];
      try {
        for (const item of order.items) {
          await decrementVariantStock(item.variantId, item.quantity, tx);
          reserved.push({ variantId: item.variantId, quantity: item.quantity });
        }
      } catch (err) {
        if (!(err instanceof InsufficientStockError)) throw err;
        for (const r of reserved) {
          await tx.productVariant.update({
            where: { id: r.variantId },
            data: { stock: { increment: r.quantity } },
          });
        }
        await tx.order.update({ where: { id: order.id }, data: paidData });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "system",
            payload: {
              event: "stripe_paid_after_expiry",
              detail: "stock unavailable; order stays cancelled — refund in Stripe",
            },
            actorId: null,
          },
        });
        return { outcome: "paid_but_cancelled", ...ref };
      }
    }

    const promote =
      order.status === OrderStatus.AWAITING_PAYMENT ||
      order.status === OrderStatus.CANCELLED;
    await tx.order.update({
      where: { id: order.id },
      data: {
        ...paidData,
        ...(promote
          ? { status: OrderStatus.NEW, cancelledAt: null, cancelReason: null }
          : {}),
      },
    });
    if (promote) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "status_change",
          payload: {
            from: order.status,
            to: OrderStatus.NEW,
            reason: "stripe_paid",
          },
          actorId: null,
        },
      });
    }
    return { outcome: "paid", ...ref };
  });
}

/**
 * Cancel an unpaid Stripe order whose Checkout Session expired (webhook or
 * cron backstop). Delegates to {@link updateOrderStatus}, so crossing into
 * CANCELLED re-credits the reserved stock. No-op unless the order is still
 * AWAITING_PAYMENT and unpaid — safe against completed/expired races and
 * webhook replays.
 */
export async function cancelExpiredStripeOrder(
  sessionId: string,
): Promise<{ cancelled: boolean; orderId?: string }> {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    select: { id: true, status: true, paymentStatus: true },
  });
  if (
    !order ||
    order.status !== OrderStatus.AWAITING_PAYMENT ||
    order.paymentStatus === PaymentStatus.PAID
  ) {
    return { cancelled: false, orderId: order?.id };
  }
  await updateOrderStatus(order.id, OrderStatus.CANCELLED, null, "payment_expired");
  return { cancelled: true, orderId: order.id };
}

/**
 * Record a full Stripe refund (from the `charge.refunded` webhook). Payment
 * bookkeeping only — order status and stock are left for the admin to manage.
 */
export async function markOrderRefundedByPaymentIntent(
  paymentIntentId: string,
): Promise<{ found: boolean; orderId?: string }> {
  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, paymentStatus: true },
  });
  if (!order) return { found: false };
  if (order.paymentStatus === PaymentStatus.REFUNDED) {
    return { found: true, orderId: order.id };
  }
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.REFUNDED },
    }),
    prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "system",
        payload: { event: "charge.refunded" },
        actorId: null,
      },
    }),
  ]);
  return { found: true, orderId: order.id };
}

/**
 * Stripe orders still AWAITING_PAYMENT well past the 1-hour session expiry —
 * their expiry (or completed) webhook was missed. The cron backstop
 * reconciles each against Stripe before cancelling.
 */
export async function listStaleAwaitingPaymentOrders(
  olderThanHours = 2,
  take = 50,
): Promise<{ id: string; stripeSessionId: string | null }[]> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  return prisma.order.findMany({
    where: {
      status: OrderStatus.AWAITING_PAYMENT,
      paymentMethod: PaymentMethod.STRIPE,
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take,
    select: { id: true, stripeSessionId: true },
  });
}
