import { prisma, OrderStatus, Prisma } from "@workspace/db";
import type { Customer, Emirate, Order, OrderItem } from "@workspace/db";

/** Minimal Prisma client surface shared by the live client and a transaction. */
type Db = Pick<typeof prisma, "customer">;

/** Statuses that count as real sales — mirrors orders.repo's analytics. */
const SALES_STATUSES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export type UpsertCustomerInput = {
  phone: string; // canonical E.164
  name: string;
  email?: string | null;
  locale: string;
  emirate: Emirate;
  city: string;
  addressLine1: string;
  addressLine2?: string | null;
  /** Whether the customer ticked the marketing opt-in on this order. */
  marketingConsent: boolean;
};

/**
 * Upsert the customer behind an order, keyed on verified phone. Refreshes the
 * contact + latest-address snapshot every time, and records marketing consent.
 *
 * Consent is only ever GRANTED here — an unticked box on a later order never
 * revokes an earlier opt-in (that's what an explicit unsubscribe flow is for).
 * Pass the transaction client so this participates in createOrder's atomic write.
 *
 * Returns the customer id so the caller can link `order.customerId`.
 */
export async function upsertCustomerForOrder(
  input: UpsertCustomerInput,
  db: Db = prisma,
): Promise<string> {
  const snapshot = {
    name: input.name,
    email: input.email ?? null,
    locale: input.locale,
    emirate: input.emirate,
    city: input.city,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 ?? null,
  };

  // Grant-only consent block, applied on both create and update.
  const grantConsent = input.marketingConsent
    ? {
        marketingConsent: true,
        consentAt: new Date(),
        consentSource: "checkout",
        unsubscribedAt: null,
      }
    : {};

  const customer = await db.customer.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      ...snapshot,
      ...grantConsent,
    },
    update: {
      ...snapshot,
      ...grantConsent,
    },
    select: { id: true },
  });

  return customer.id;
}

export type CustomerStats = {
  /** Count of real-sale orders (excludes pending/cancelled/refused). */
  ordersCount: number;
  /** Sum of totals across real-sale orders, in fils. */
  totalSpentFils: number;
  /** Most recent real-sale order timestamp, or null if none yet. */
  lastOrderAt: Date | null;
};

export type CustomerListItem = Customer & CustomerStats;

export type ListCustomersFilter = {
  /** Free-text match against name or phone. */
  q?: string;
  /** Only customers with a live marketing opt-in. */
  consentOnly?: boolean;
  emirate?: Emirate;
  take?: number;
};

const EMPTY_STATS: CustomerStats = {
  ordersCount: 0,
  totalSpentFils: 0,
  lastOrderAt: null,
};

/**
 * Aggregate real-sale stats for a set of customer ids in one groupBy query.
 * Returns a map id → stats; ids with no sales are simply absent (caller
 * falls back to EMPTY_STATS).
 */
async function statsForCustomerIds(
  ids: string[],
): Promise<Map<string, CustomerStats>> {
  const map = new Map<string, CustomerStats>();
  if (ids.length === 0) return map;

  const grouped = await prisma.order.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids }, status: { in: SALES_STATUSES } },
    _count: { _all: true },
    _sum: { totalFils: true },
    _max: { createdAt: true },
  });

  for (const row of grouped) {
    if (!row.customerId) continue;
    map.set(row.customerId, {
      ordersCount: row._count._all,
      totalSpentFils: row._sum.totalFils ?? 0,
      lastOrderAt: row._max.createdAt ?? null,
    });
  }
  return map;
}

/**
 * List customers matching the DB-level filters (search / consent / emirate),
 * each enriched with derived lifetime stats. Fetches a bounded window; the
 * caller applies any in-memory segmenting (e.g. repeat-buyers) + pagination,
 * mirroring the admin orders page.
 */
export async function listCustomers(
  filter: ListCustomersFilter = {},
): Promise<CustomerListItem[]> {
  const where: Prisma.CustomerWhereInput = {};

  if (filter.q) {
    const q = filter.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q.replace(/\s/g, "") } },
    ];
  }
  if (filter.consentOnly) where.marketingConsent = true;
  if (filter.emirate) where.emirate = filter.emirate;

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filter.take ?? 500,
  });

  const stats = await statsForCustomerIds(customers.map((c) => c.id));

  return customers.map((c) => ({
    ...c,
    ...(stats.get(c.id) ?? EMPTY_STATS),
  }));
}

export type CustomerWithOrders = Customer & {
  orders: (Order & { items: OrderItem[] })[];
  stats: CustomerStats;
};

/** A single customer with full order history (newest first) and stats. */
export async function getCustomerById(
  id: string,
): Promise<CustomerWithOrders | null> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
  if (!customer) return null;

  const stats = (await statsForCustomerIds([id])).get(id) ?? EMPTY_STATS;
  return { ...customer, stats };
}

/** Total count of customers (for the admin header). */
export async function countCustomers(): Promise<number> {
  return prisma.customer.count();
}
