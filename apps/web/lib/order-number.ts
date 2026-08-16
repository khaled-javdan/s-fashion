import type { Prisma } from "@workspace/db";

/** Zero-padding width of the numeric suffix (`SF-2026-00007`). */
const PAD = 5;

/**
 * Generate a human-readable order number in the form `SF-{YYYY}-{NNNNN}`.
 *
 * The numeric suffix is `max(existing suffix for this year) + 1`, **not** a row
 * count. Counting is not safe here: any order that is ever deleted leaves the
 * count permanently below the highest issued number, so every subsequent
 * checkout regenerates an already-taken number and fails the unique constraint
 * on every retry — a hard checkout outage rather than a transient race.
 * Deriving from the max only ever moves forward, so gaps are harmless.
 *
 * **Must be called inside a Prisma transaction** (pass the transaction client
 * `tx`) so the read and the subsequent `Order` insert run atomically.
 *
 * Example: `SF-2026-00007`
 *
 * Note: the `Order.orderNumber` column has a unique constraint. Under READ
 * COMMITTED two concurrent checkouts can still read the same max and race; the
 * loser gets a unique-violation and retries, and because the winner's row is
 * now committed the retry reads a higher max and succeeds. The @unique index
 * stays the authoritative guard.
 */
export async function generateOrderNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `SF-${year}-`;

  // Parse the suffix in SQL so the comparison is numeric: a lexicographic
  // ORDER BY would rank `SF-2026-100000` below `SF-2026-99999` once the suffix
  // outgrows its padding. The regexp also skips any row whose number doesn't
  // match the scheme instead of erroring on the cast.
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX((regexp_match("orderNumber", '^SF-[0-9]{4}-([0-9]+)$'))[1]::int) AS max
    FROM "Order"
    WHERE "orderNumber" LIKE ${`${prefix}%`}
  `;

  const max = rows[0]?.max ?? 0;
  return `${prefix}${String(max + 1).padStart(PAD, "0")}`;
}
