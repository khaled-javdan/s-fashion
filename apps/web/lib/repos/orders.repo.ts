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
};

export type CreateOrderInput = Omit<OrderCreateInput, "items"> & {
  subtotalFils: number;
  shippingFils: number;
  totalFils: number;
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
        emirate: input.emirate,
        city: input.city,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        notes: input.notes ?? null,
        subtotalFils: input.subtotalFils,
        shippingFils: input.shippingFils,
        totalFils: input.totalFils,
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
