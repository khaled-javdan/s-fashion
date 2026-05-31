import { prisma, Prisma, OrderStatus, Size } from "@workspace/db";
import type {
  Product,
  ProductVariant,
  ProductImage,
} from "@workspace/db";
import {
  sizeChartSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
  type SizeChartRowInput,
} from "@/lib/schemas/product.schema";

export type ProductWithRelations = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

/**
 * Parse a product's stored `sizeChart` JSON into validated rows, or `null` when
 * the product has no override (and the storefront should fall back to the
 * global `size_chart.cm` setting). Malformed JSON is treated as no override.
 */
export function parseProductSizeChartRows(
  value: Product["sizeChart"],
): SizeChartRowInput[] | null {
  if (value == null) return null;
  const parsed = sizeChartSchema.safeParse(value);
  return parsed.success ? parsed.data.rows : null;
}

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

/** Sort options for the public products listing. */
export type ProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "best_selling";

export const PRODUCT_SORTS: readonly ProductSort[] = [
  "newest",
  "price_asc",
  "price_desc",
  "best_selling",
] as const;

export type ProductFilter = {
  /** Variant colour hex values (lowercased) to match — OR within colours. */
  colors?: string[];
  /** Sizes to match — OR within sizes. */
  sizes?: Size[];
  /** Inclusive price floor in fils. */
  minFils?: number;
  /** Inclusive price ceiling in fils. */
  maxFils?: number;
  /** Only products with at least one in-stock variant. */
  inStockOnly?: boolean;
  /** Only products whose compare-at price is above the live price. */
  onSaleOnly?: boolean;
  sort?: ProductSort;
  take?: number;
  skip?: number;
};

/** Result of a filtered listing: the page of products plus the total match count. */
export type FilteredProducts = {
  products: ProductWithRelations[];
  total: number;
};

/**
 * Build the Prisma `where` for the public catalogue from a filter. Colour and
 * size constraints are expressed as `variants.some` so a product matches when
 * ANY of its variants satisfies the (colour AND/OR size) constraint. Price is a
 * product-level scalar range; sale compares compare-at to live price.
 */
function catalogWhere(filter: ProductFilter): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true };

  if (filter.minFils != null || filter.maxFils != null) {
    where.priceFils = {
      ...(filter.minFils != null ? { gte: filter.minFils } : {}),
      ...(filter.maxFils != null ? { lte: filter.maxFils } : {}),
    };
  }

  if (filter.onSaleOnly) {
    // A genuine sale = compare-at set and strictly above the live price. Prisma
    // can't compare two columns, so require compare-at present and refine below.
    where.compareAtFils = { not: null };
  }

  const colors = filter.colors?.filter(Boolean) ?? [];
  const sizes = filter.sizes ?? [];
  const variantConds: Prisma.ProductVariantWhereInput = {};
  if (colors.length > 0) {
    variantConds.colorHex = {
      in: colors,
      mode: "insensitive",
    };
  }
  if (sizes.length > 0) {
    variantConds.size = { in: sizes };
  }
  if (filter.inStockOnly) {
    variantConds.stock = { gt: 0 };
  }
  if (Object.keys(variantConds).length > 0) {
    where.variants = { some: variantConds };
  }

  return where;
}

const SORT_ORDER: Record<
  Exclude<ProductSort, "best_selling">,
  Prisma.ProductOrderByWithRelationInput
> = {
  newest: { createdAt: "desc" },
  price_asc: { priceFils: "asc" },
  price_desc: { priceFils: "desc" },
};

/**
 * Public catalogue with attribute filters, sorting and pagination. There are no
 * categories — filtering is purely by variant attributes (colour, size,
 * stock), price range and sale status. `best_selling` ranks by total sold
 * quantity (counting only orders that count), falling back to newest for ties /
 * unsold products. Returns the page plus the total match count for pagination.
 */
export async function listProductsFiltered(
  filter: ProductFilter = {},
): Promise<FilteredProducts> {
  const where = catalogWhere(filter);
  const take = filter.take;
  const skip = filter.skip;

  // The DB can't column-compare compare-at vs price, so when `onSaleOnly` is
  // set we over-fetch, then filter in memory and paginate ourselves.
  const onSaleRefine = (rows: ProductWithRelations[]) =>
    filter.onSaleOnly
      ? rows.filter(
          (p) => p.compareAtFils != null && p.compareAtFils > p.priceFils,
        )
      : rows;

  if (filter.sort === "best_selling") {
    // Rank by sold quantity across counting orders, then newest. Fetch all
    // matches (the catalogue is small), order in memory, then paginate.
    const all = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { variants: true, images: { orderBy: { position: "asc" } } },
    });
    const matched = onSaleRefine(all);

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
    const soldByProduct = new Map<string, number>();
    if (sold.length > 0) {
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: sold.map((s) => s.variantId) } },
        select: { id: true, productId: true },
      });
      const variantToProduct = new Map(variants.map((v) => [v.id, v.productId]));
      for (const row of sold) {
        const productId = variantToProduct.get(row.variantId);
        if (!productId) continue;
        soldByProduct.set(
          productId,
          (soldByProduct.get(productId) ?? 0) + (row._sum.quantity ?? 0),
        );
      }
    }
    matched.sort((a, b) => {
      const diff = (soldByProduct.get(b.id) ?? 0) - (soldByProduct.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const total = matched.length;
    const start = skip ?? 0;
    const page =
      take != null ? matched.slice(start, start + take) : matched.slice(start);
    return { products: page, total };
  }

  const orderBy =
    SORT_ORDER[(filter.sort ?? "newest") as Exclude<ProductSort, "best_selling">];

  if (filter.onSaleOnly) {
    // In-memory sale refinement + pagination (rare path, small catalogue).
    const all = await prisma.product.findMany({
      where,
      orderBy,
      include: { variants: true, images: { orderBy: { position: "asc" } } },
    });
    const matched = onSaleRefine(all);
    const total = matched.length;
    const start = skip ?? 0;
    const page =
      take != null ? matched.slice(start, start + take) : matched.slice(start);
    return { products: page, total };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      take,
      skip,
      include: { variants: true, images: { orderBy: { position: "asc" } } },
    }),
    prisma.product.count({ where }),
  ]);
  return { products, total };
}

/** A selectable colour facet — hex plus a bilingual label drawn from variants. */
export type ColorFacet = {
  hex: string;
  nameEn: string | null;
  nameAr: string | null;
};

/** Available filter facets for the catalogue, derived from active products. */
export type CatalogFacets = {
  colors: ColorFacet[];
  sizes: Size[];
  minFils: number;
  maxFils: number;
};

/**
 * Derive the filter facets for the public catalogue from active products:
 * distinct variant colours (with their best bilingual label), the set of sizes
 * actually present (ordered by the `Size` enum), and the price bounds. Returns
 * zeroed price bounds and empty lists when there are no active products.
 */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  const [variants, priceAgg] = await Promise.all([
    prisma.productVariant.findMany({
      where: { product: { isActive: true } },
      select: {
        colorHex: true,
        colorNameEn: true,
        colorNameAr: true,
        size: true,
      },
    }),
    prisma.product.aggregate({
      where: { isActive: true },
      _min: { priceFils: true },
      _max: { priceFils: true },
    }),
  ]);

  const colorMap = new Map<string, ColorFacet>();
  const sizeSet = new Set<Size>();
  for (const v of variants) {
    sizeSet.add(v.size);
    if (!v.colorHex) continue;
    const key = v.colorHex.toLowerCase();
    const existing = colorMap.get(key);
    if (existing) {
      // Backfill any missing label from a later variant carrying it.
      if (!existing.nameEn && v.colorNameEn) existing.nameEn = v.colorNameEn;
      if (!existing.nameAr && v.colorNameAr) existing.nameAr = v.colorNameAr;
    } else {
      colorMap.set(key, {
        hex: key,
        nameEn: v.colorNameEn ?? null,
        nameAr: v.colorNameAr ?? null,
      });
    }
  }

  // Order sizes by the canonical enum order rather than discovery order.
  const sizeOrder = Object.values(Size) as Size[];
  const sizes = sizeOrder.filter((s) => sizeSet.has(s));

  return {
    colors: [...colorMap.values()].sort((a, b) => a.hex.localeCompare(b.hex)),
    sizes,
    minFils: priceAgg._min.priceFils ?? 0,
    maxFils: priceAgg._max.priceFils ?? 0,
  };
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
        costPriceFils: input.costPriceFils,
        isActive: input.isActive,
        isFinalSale: input.isFinalSale,
        sizeChart: input.sizeChart ?? Prisma.JsonNull,
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
        // `undefined` leaves the column untouched; an explicit `null` clears the
        // override back to the global default; a value writes the override.
        ...(input.sizeChart === undefined
          ? {}
          : { sizeChart: input.sizeChart ?? Prisma.JsonNull }),
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

/**
 * Best-selling active products with full relations, ready for `ProductCard`.
 *
 * Self-contained sibling of `listPopularProducts` (which returns only a link
 * shape): ranks products by total quantity sold across orders that count
 * (excludes CANCELLED / REFUSED / PENDING_VERIFICATION), then tops up
 * newest-first so a fresh store still fills the row. Returns at most `take`
 * fully-hydrated products (variants + ordered images).
 */
export async function listBestSellerProducts(
  take = 8,
): Promise<ProductWithRelations[]> {
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

  // 2. Roll variant sales up to their owning product.
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

  // 3. Active products with full relations, newest first; reorder sellers up.
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      variants: true,
      images: { orderBy: { position: "asc" } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const out: ProductWithRelations[] = [];
  const used = new Set<string>();
  for (const id of rankedIds) {
    const p = byId.get(id);
    if (p && !used.has(id)) {
      used.add(id);
      out.push(p);
    }
    if (out.length >= take) return out;
  }
  for (const p of products) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    out.push(p);
    if (out.length >= take) break;
  }
  return out;
}
