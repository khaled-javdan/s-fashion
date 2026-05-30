import { prisma, Prisma, OrderStatus } from "@workspace/db";
import type {
  Product,
  ProductVariant,
  ProductImage,
} from "@workspace/db";
import type {
  ProductCreateInput,
  ProductUpdateInput,
} from "@/lib/schemas/product.schema";

export type ProductWithRelations = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

export type ListOpts = {
  take?: number;
  skip?: number;
};

/** Public catalog: only active products. Newest first. */
export async function listActiveProducts(
  opts: ListOpts = {},
): Promise<ProductWithRelations[]> {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: opts.take,
    skip: opts.skip,
    include: {
      variants: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}

/** Minimal product shape for link pickers (hero CTA, etc.). */
export type ProductLinkOption = {
  slug: string;
  nameEn: string;
  nameAr: string;
};

/**
 * Active products ranked best-seller-first: by total quantity sold across
 * orders that actually count (excludes cancelled / refused / unverified).
 * Products with no sales are appended newest-first, so the list is never empty
 * on a fresh store. Returns at most `take` entries.
 */
export async function listPopularProducts(
  take = 10,
): Promise<ProductLinkOption[]> {
  // 1. Sum sold quantity per variant from orders that count.
  const sold = await prisma.orderItem.groupBy({
    by: ["variantId"],
    _sum: { quantity: true },
    where: {
      order: {
        status: {
          notIn: [
            OrderStatus.CANCELLED,
            OrderStatus.REFUSED,
            OrderStatus.PENDING_VERIFICATION,
          ],
        },
      },
    },
  });

  // 2. Roll variant sales up to their product.
  const soldByProduct = new Map<string, number>();
  if (sold.length > 0) {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: sold.map((s) => s.variantId) } },
      select: { id: true, productId: true },
    });
    const variantToProduct = new Map(
      variants.map((v) => [v.id, v.productId]),
    );
    for (const row of sold) {
      const productId = variantToProduct.get(row.variantId);
      if (!productId) continue;
      soldByProduct.set(
        productId,
        (soldByProduct.get(productId) ?? 0) + (row._sum.quantity ?? 0),
      );
    }
  }
  const rankedIds = [...soldByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // 3. Active products, newest first; reorder best-sellers to the front.
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, nameEn: true, nameAr: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const out: ProductLinkOption[] = [];
  const used = new Set<string>();
  const push = (p: { slug: string; nameEn: string; nameAr: string }) =>
    out.push({ slug: p.slug, nameEn: p.nameEn, nameAr: p.nameAr });

  for (const id of rankedIds) {
    const p = byId.get(id);
    if (p && !used.has(id)) {
      used.add(id);
      push(p);
    }
    if (out.length >= take) return out;
  }
  for (const p of products) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    push(p);
    if (out.length >= take) break;
  }
  return out;
}

/** Stock at or below this is considered "low" for dashboard alerts. */
export const LOW_STOCK_THRESHOLD = 3;

/** Count variants of active products that are at or below the low-stock line. */
export async function countLowStockVariants(
  threshold = LOW_STOCK_THRESHOLD,
): Promise<number> {
  return prisma.productVariant.count({
    where: {
      stock: { lte: threshold },
      product: { isActive: true },
    },
  });
}

/**
 * "You may also like" — active products related to the given one. With no
 * categories in the model, relatedness is price proximity: candidates within
 * ±40% of the price, sorted by closeness, then topped up with newest products
 * so the row is never short. Excludes the current product.
 */
export async function listSimilarProducts(opts: {
  excludeId: string;
  priceFils: number;
  take?: number;
}): Promise<ProductWithRelations[]> {
  const take = opts.take ?? 8;
  const lo = Math.floor(opts.priceFils * 0.6);
  const hi = Math.ceil(opts.priceFils * 1.4);

  // `variants: { some: stock > 0 }` keeps only products with something in
  // stock, so fully sold-out products are never recommended.
  const inStock = { variants: { some: { stock: { gt: 0 } } } };
  const band = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: opts.excludeId },
      priceFils: { gte: lo, lte: hi },
      ...inStock,
    },
    orderBy: { createdAt: "desc" },
    take: take * 3,
    include: { variants: true, images: { orderBy: { position: "asc" } } },
  });
  band.sort(
    (a, b) =>
      Math.abs(a.priceFils - opts.priceFils) -
      Math.abs(b.priceFils - opts.priceFils),
  );

  const picked = band.slice(0, take);
  if (picked.length >= take) return picked;

  // Top up with the newest other products not already included.
  const excludeIds = [opts.excludeId, ...picked.map((p) => p.id)];
  const fill = await prisma.product.findMany({
    where: { isActive: true, id: { notIn: excludeIds }, ...inStock },
    orderBy: { createdAt: "desc" },
    take: take - picked.length,
    include: { variants: true, images: { orderBy: { position: "asc" } } },
  });
  return [...picked, ...fill];
}

/** PDP fetch. Returns `null` when slug doesn't exist OR product is inactive. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: true,
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!product || !product.isActive) return null;
  return product;
}

/** Admin fetch — returns inactive products too. */
export async function getProductById(
  id: string,
): Promise<ProductWithRelations | null> {
  return prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}

/** Admin list — includes inactive. */
export async function listAllProductsForAdmin(
  opts: ListOpts = {},
): Promise<ProductWithRelations[]> {
  return prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    take: opts.take,
    skip: opts.skip,
    include: {
      variants: true,
      images: { orderBy: { position: "asc" } },
    },
  });
}

/** Create a product + its variants + images in one transaction. */
export async function createProduct(
  input: ProductCreateInput,
): Promise<ProductWithRelations> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        slug: input.slug,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descAr: input.descAr ?? null,
        descEn: input.descEn ?? null,
        additionalInfoAr: input.additionalInfoAr ?? null,
        additionalInfoEn: input.additionalInfoEn ?? null,
        priceFils: input.priceFils,
        compareAtFils: input.compareAtFils ?? null,
        costPriceFils: input.costPriceFils ?? null,
        isActive: input.isActive,
        isFinalSale: input.isFinalSale,
        variants: {
          create: input.variants.map((v) => ({
            colorNameAr: v.colorNameAr ?? null,
            colorNameEn: v.colorNameEn ?? null,
            colorHex: v.colorHex ?? null,
            size: v.size,
            stock: v.stock,
            sku: v.sku ?? null,
          })),
        },
        images: {
          create: input.images.map((i, idx) => ({
            url: i.url,
            altAr: i.altAr ?? null,
            altEn: i.altEn ?? null,
            colorHex: i.colorHex ?? null,
            position: i.position ?? idx,
          })),
        },
      },
      include: {
        variants: true,
        images: { orderBy: { position: "asc" } },
      },
    });
    return product;
  });
}

/**
 * Update a product's scalar fields and (optionally) fully replace its variants/images.
 * If `variants` is provided, the existing set is reconciled by `id` (existing variants
 * with stock or order history are preserved on update; new ones inserted; missing ones deleted).
 * If `images` is provided, the existing set is replaced wholesale (images have no FKs from elsewhere).
 */
export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<ProductWithRelations> {
  return prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        slug: input.slug,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descAr: input.descAr,
        descEn: input.descEn,
        additionalInfoAr: input.additionalInfoAr,
        additionalInfoEn: input.additionalInfoEn,
        priceFils: input.priceFils,
        compareAtFils: input.compareAtFils,
        costPriceFils: input.costPriceFils,
        isActive: input.isActive,
        isFinalSale: input.isFinalSale,
      },
    });

    if (input.variants) {
      const existing = await tx.productVariant.findMany({
        where: { productId: id },
        select: { id: true },
      });
      const incomingIds = new Set(
        input.variants.map((v) => v.id).filter((x): x is string => Boolean(x)),
      );
      const toDelete = existing
        .map((e) => e.id)
        .filter((eid) => !incomingIds.has(eid));

      if (toDelete.length > 0) {
        await tx.productVariant.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      for (const v of input.variants) {
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              colorNameAr: v.colorNameAr ?? null,
              colorNameEn: v.colorNameEn ?? null,
              colorHex: v.colorHex ?? null,
              size: v.size,
              stock: v.stock,
              sku: v.sku ?? null,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              colorNameAr: v.colorNameAr ?? null,
              colorNameEn: v.colorNameEn ?? null,
              colorHex: v.colorHex ?? null,
              size: v.size,
              stock: v.stock,
              sku: v.sku ?? null,
            },
          });
        }
      }
    }

    if (input.images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (input.images.length > 0) {
        await tx.productImage.createMany({
          data: input.images.map((i, idx) => ({
            productId: id,
            url: i.url,
            altAr: i.altAr ?? null,
            altEn: i.altEn ?? null,
            colorHex: i.colorHex ?? null,
            position: i.position ?? idx,
          })),
        });
      }
    }

    const updated = await tx.product.findUniqueOrThrow({
      where: { id },
      include: {
        variants: true,
        images: { orderBy: { position: "asc" } },
      },
    });
    return updated;
  });
}

/** Flip `isActive`. Returns the new boolean. */
export async function toggleProductActive(id: string): Promise<boolean> {
  const current = await prisma.product.findUniqueOrThrow({
    where: { id },
    select: { isActive: true },
  });
  const next = !current.isActive;
  await prisma.product.update({
    where: { id },
    data: { isActive: next },
  });
  return next;
}

/** Insufficient stock for the requested decrement. */
export class InsufficientStockError extends Error {
  constructor(
    public readonly variantId: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Insufficient stock for variant ${variantId}: requested ${requested}, available ${available}`,
    );
    this.name = "InsufficientStockError";
  }
}

/**
 * Atomically decrement a variant's stock. Throws InsufficientStockError if not enough.
 * Accepts an optional transaction client so callers (e.g. createOrder) can run this
 * inside their own transaction.
 */
export async function decrementVariantStock(
  variantId: string,
  qty: number,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  if (qty <= 0) throw new Error("qty must be positive");

  // Conditional update — only succeeds when stock >= qty. count=0 means insufficient.
  const result = await client.productVariant.updateMany({
    where: { id: variantId, stock: { gte: qty } },
    data: { stock: { decrement: qty } },
  });

  if (result.count === 0) {
    const variant = await client.productVariant.findUnique({
      where: { id: variantId },
      select: { stock: true },
    });
    throw new InsufficientStockError(variantId, variant?.stock ?? 0, qty);
  }
}
