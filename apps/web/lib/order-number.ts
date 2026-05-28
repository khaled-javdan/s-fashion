import type { Prisma } from "@workspace/db";

/**
 * Generate a human-readable order number in the form `SF-{YYYY}-{NNNNN}`.
 *
 * The numeric suffix is derived from `count(Order.createdAt within current year) + 1`.
 * **Must be called inside a Prisma transaction** (pass the transaction client `tx`)
 * so the count and the subsequent `Order` insert run atomically. Otherwise two
 * concurrent inserts could read the same count and produce duplicate order numbers.
 *
 * Example: `SF-2026-00007`
 *
 * Note: the `Order.orderNumber` column has a unique constraint, so even if a race
 * leaks past the transaction boundary the second writer will get a unique-violation
 * and can retry. We rely on the @unique index as the authoritative guard.
 */
export async function generateOrderNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

  const count = await tx.order.count({
    where: {
      createdAt: {
        gte: yearStart,
        lt: yearEnd,
      },
    },
  });

  const padded = String(count + 1).padStart(5, "0");
  return `SF-${year}-${padded}`;
}
