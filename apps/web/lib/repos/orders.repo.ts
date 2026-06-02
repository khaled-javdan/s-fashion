import { prisma, OrderStatus, Prisma } from "@workspace/db";
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
export type OrderWithItemsAndEvents = Order & {
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
        const order = await tx.order.create({
          data: {
            orderNumber,
            status: OrderStatus.NEW,
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
                payload: { to: OrderStatus.NEW },
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
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderWithItemsAndEvents | null> {
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
        status: { not: OrderStatus.PENDING_VERIFICATION },
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

  const since = new Date(startKey * 86_400_000 - UAE_OFFSET_MS);
  const until = new Date((endKey + 1) * 86_400_000 - UAE_OFFSET_MS); // exclusive

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

  for (const order of orders) {
    const delivered = order.status === OrderStatus.DELIVERED;
    totalSalesFils += order.totalFils;
    netRevenueFils += order.subtotalFils;
    if (delivered) collectedFils += order.totalFils;

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
    daily,
    topProducts,
    from: dayKeyToIso(startKey),
    to: dayKeyToIso(endKey),
  };
}

/**
 * Order IDs whose notifications haven't all been delivered yet — i.e. the
 * Telegram owner alert is unstamped, or the customer has an email but the
 * confirmation is unstamped. Scoped to real (verified) orders placed within the
 * lookback window so the retry cron never resurrects ancient or abandoned
 * (PENDING_VERIFICATION) orders. Newest first, capped to `take`.
 */
export async function listOrderIdsAwaitingNotification(
  lookbackHours = 24,
  take = 50,
): Promise<string[]> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const rows = await prisma.order.findMany({
    where: {
      status: { not: OrderStatus.PENDING_VERIFICATION },
      createdAt: { gte: since },
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
