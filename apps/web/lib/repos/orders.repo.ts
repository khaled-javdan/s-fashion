import { prisma, OrderStatus, Prisma } from "@workspace/db";
import type { Order, OrderItem, OrderEvent } from "@workspace/db";
import { generateOrderNumber } from "@/lib/order-number";
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

export type CreateOrderInput = Omit<OrderCreateInput, "items"> & {
  subtotalFils: number;
  shippingFils: number;
  totalFils: number;
  /** Currency the customer saw + the AED→currency rate at order time. */
  displayCurrency: string;
  fxRate: number;
};

/**
 * Create an order atomically:
 *   1. Reserve stock (decrementVariantStock).
 *   2. Generate order number from the in-transaction count.
 *   3. Insert order + snapshot items + initial status_change event.
 *
 * Throws `InsufficientStockError` if any variant has insufficient stock; the entire
 * transaction is rolled back in that case.
 */
export async function createOrder(
  input: CreateOrderInput,
  items: ResolvedOrderItem[],
): Promise<{ id: string; orderNumber: string }> {
  return prisma.$transaction(async (tx) => {
    // 1. Reserve stock for every line item up-front. Any failure aborts the tx.
    for (const item of items) {
      await decrementVariantStock(item.variantId, item.quantity, tx);
    }

    // 2. Derive a fresh order number inside the transaction.
    const orderNumber = await generateOrderNumber(tx);

    // 3. Insert the order with snapshot items.
    const order = await tx.order.create({
      data: {
        orderNumber,
        status: OrderStatus.PENDING_VERIFICATION,
        customerName: input.customerName,
        phone: input.phone,
        phoneVerified: false,
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
            payload: { to: OrderStatus.PENDING_VERIFICATION },
            actorId: null,
          },
        },
      },
      select: { id: true, orderNumber: true },
    });

    return order;
  });
}

/** Re-export so callers handle the error without depending on products.repo. */
export { InsufficientStockError };

/** Mark phone verified and move PENDING_VERIFICATION → NEW. Idempotent: no-ops if already NEW+. */
export async function markPhoneVerified(orderId: string): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    if (order.phoneVerified && order.status !== OrderStatus.PENDING_VERIFICATION) {
      return order;
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        phoneVerified: true,
        status: OrderStatus.NEW,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        type: "status_change",
        payload: { from: order.status, to: OrderStatus.NEW, reason: "phone_verified" },
        actorId: null,
      },
    });

    return updated;
  });
}

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
const SALES_STATUSES: OrderStatus[] = [
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
 * Move an order to a new status. Idempotent (no-op if already there).
 * - Appends an OrderEvent of type "status_change".
 * - Sets the timestamp column corresponding to the target status.
 * - On CANCELLED/REFUSED, re-credits stock for every line item (unless already credited
 *   — we guard via the current status check at the top so this only runs on first transition).
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

    // Re-credit stock only when crossing into a cancellation state for the first time.
    if (
      RECREDIT_STATUSES.has(newStatus) &&
      !RECREDIT_STATUSES.has(order.status)
    ) {
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
