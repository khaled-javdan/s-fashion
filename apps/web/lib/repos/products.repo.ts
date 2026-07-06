import { prisma, Prisma, OrderStatus, Size } from "@workspace/db";
import {
  type ProductCreateInput,
  type ProductUpdateInput,
} from "@/lib/schemas/product.schema";
import type { ProductSource } from "@/lib/home-sections-config";

// Client-safe types + helpers live in a prisma-free module so that client
// components can import them without bundling the server-only Prisma client.
// Re-exported here for backward compatibility with existing server imports.
export {
  parseProductSizeChart,
  parseProductSizeChartRows,
  type ProductWithRelations,
} from "@/lib/repos/products.shared";
import type { ProductWithRelations } from "@/lib/repos/products.shared";

export type ListOpts = {
  take?: number;
  skip?: number;
};

/**
 * Interactive-transaction options for product create/update. The default
 * timeout is 5s, but a product with many variants reconciles each one in its
 * own `update` round-trip inside the transaction (e.g. 35 variants > 5s), which
 * trips Prisma's P2028 "expired transaction". Give the transaction room, and a
 * longer `maxWait` to acquire a connection under load.
 */
const TX_OPTS = { timeout: 30_000, maxWait: 10_000 } as const;

/**
 * Shared Prisma include for product variants that filters out archived rows.
 * Archived variants stay in the DB to keep OrderItem FK references valid, but
 * never surface in the storefront or admin product editor.
 */
const activeVariantsInclude = {
  where: { isArchived: false },
} as const;

/**
 * Default display order: admin-curated `sortOrder` first (lower shows first),
 * newest breaking ties. Every product defaults to `sortOrder: 0`, so this is
 * indistinguishable from newest-first until an admin actually reorders.
 */
const DEFAULT_ORDER_BY: Prisma.ProductOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "desc" },
];

/** Public catalog: only active products. Admin-ordered, newest breaking ties. */
export async function listActiveProducts(
  opts: ListOpts = {},
): Promise<ProductWithRelations[]> {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: DEFAULT_ORDER_BY,
    take: opts.take,
    skip: opts.skip,
    include: {
      variants: activeVariantsInclude,
      images: { orderBy: { position: "asc" } },
    },
  });
}

/**
 * Sort options for the public products listing. `relevance` only makes sense
 * alongside a text query (`q`) — it ranks by trigram similarity and is the
 * default sort whenever a query is present.
 */
export type ProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "relevance";

export const PRODUCT_SORTS: readonly ProductSort[] = [
  "newest",
  "price_asc",
  "price_desc",
  "best_selling",
  "relevance",
] as const;

/** Minimum query length before a search runs (shorter inputs are ignored). */
export const SEARCH_MIN_CHARS = 2;

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
  /** Free-text search across product name/description (Arabic + English). */
  q?: string;
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
function catalogWhere(
  filter: ProductFilter,
  idIn?: string[],
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true };

  // Restrict to a pre-resolved id set (e.g. trigram search matches). An empty
  // array means "match nothing" — preserve that rather than treating it as
  // "no restriction".
  if (idIn) {
    where.id = { in: idIn };
  }

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
  // Always require non-archived when narrowing — archived variants must not
  // influence colour/size/stock filtering on the storefront.
  const variantConds: Prisma.ProductVariantWhereInput = { isArchived: false };
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
  // Always set; "some non-archived variant matches X" is the right semantic
  // even when X has no narrowing clauses (X = `{ isArchived: false }`).
  where.variants = { some: variantConds };

  return where;
}

const SORT_ORDER: Record<
  Exclude<ProductSort, "best_selling" | "relevance">,
  Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[]
> = {
  newest: DEFAULT_ORDER_BY,
  price_asc: { priceFils: "asc" },
  price_desc: { priceFils: "desc" },
};

/**
 * Resolve a free-text query to product ids ranked by trigram similarity. Names
 * carry the most weight; descriptions are searched too. A literal-substring
 * (`LIKE`) clause is OR'd in so exact substrings below the trigram similarity
 * threshold (common for very short queries) still match. English columns are
 * matched case-insensitively via `lower()`; Arabic has no case. The returned
 * map preserves no order — callers read scores to rank. Backed by the
 * `*_trgm` GIN indexes (see migration `product_search_trgm`).
 */
async function searchProductIds(q: string): Promise<Map<string, number>> {
  const like = `%${q}%`;
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    SELECT id, GREATEST(
      similarity(lower("nameEn"), lower(${q})),
      similarity("nameAr", ${q}),
      similarity(coalesce(lower("descEn"), ''), lower(${q})),
      similarity(coalesce("descAr", ''), ${q})
    ) AS score
    FROM "Product"
    WHERE "isActive" = true AND (
      lower("nameEn") % lower(${q})
      OR "nameAr" % ${q}
      OR lower("descEn") % lower(${q})
      OR "descAr" % ${q}
      OR lower("nameEn") LIKE lower(${like})
      OR "nameAr" LIKE ${like}
    )
    ORDER BY score DESC, "createdAt" DESC
    LIMIT 200
  `;
  // Neon may return numeric columns as strings; coerce defensively.
  return new Map(rows.map((r) => [r.id, Number(r.score)]));
}

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
  // Resolve a text query to a ranked id set up front. A blank/too-short query is
  // ignored; a real query that matches nothing short-circuits to an empty page.
  const query = filter.q?.trim() ?? "";
  let scores: Map<string, number> | null = null;
  if (query.length >= SEARCH_MIN_CHARS) {
    scores = await searchProductIds(query);
    if (scores.size === 0) return { products: [], total: 0 };
  }

  // `relevance` is meaningful only with a query; otherwise fall back to newest.
  // When a query is present and no explicit sort was chosen, default to relevance.
  const sort: ProductSort =
    filter.sort === "relevance" && !scores
      ? "newest"
      : (filter.sort ?? (scores ? "relevance" : "newest"));

  const where = catalogWhere(filter, scores ? [...scores.keys()] : undefined);
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

  if (scores && sort === "relevance") {
    // Rank the matched set by trigram score, newest breaking ties. Fetch all
    // matches (the result set is already capped by the search), sort in memory,
    // then paginate — mirroring the best-seller path below.
    const all = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { variants: activeVariantsInclude, images: { orderBy: { position: "asc" } } },
    });
    const matched = onSaleRefine(all);
    matched.sort((a, b) => {
      const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const total = matched.length;
    const start = skip ?? 0;
    const page =
      take != null ? matched.slice(start, start + take) : matched.slice(start);
    return { products: page, total };
  }

  if (sort === "best_selling") {
    // Rank by sold quantity across counting orders, then newest. Fetch all
    // matches (the catalogue is small), order in memory, then paginate.
    const all = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { variants: activeVariantsInclude, images: { orderBy: { position: "asc" } } },
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
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const total = matched.length;
    const start = skip ?? 0;
    const page =
      take != null ? matched.slice(start, start + take) : matched.slice(start);
    return { products: page, total };
  }

  const orderBy =
    SORT_ORDER[sort as Exclude<ProductSort, "best_selling" | "relevance">];

  if (filter.onSaleOnly) {
    // In-memory sale refinement + pagination (rare path, small catalogue).
    const all = await prisma.product.findMany({
      where,
      orderBy,
      include: { variants: activeVariantsInclude, images: { orderBy: { position: "asc" } } },
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
      include: { variants: activeVariantsInclude, images: { orderBy: { position: "asc" } } },
    }),
    prisma.product.count({ where }),
  ]);
  return { products, total };
}

/**
 * Products for an admin-defined home product row, by catalogue `source` preset.
 * Thin wrapper over {@link listProductsFiltered} mapping each preset to its
 * filter/sort. Returns at most `limit` products.
 */
export async function listProductsForSource(
  source: ProductSource,
  limit: number,
): Promise<ProductWithRelations[]> {
  const base = { take: limit } as const;
  switch (source) {
    case "best_selling":
      return (await listProductsFiltered({ ...base, sort: "best_selling" }))
        .products;
    case "on_sale":
      return (await listProductsFiltered({ ...base, onSaleOnly: true })).products;
    case "in_stock":
      return (await listProductsFiltered({ ...base, inStockOnly: true })).products;
    case "newest":
    case "all":
    default:
      return (await listProductsFiltered({ ...base, sort: "newest" })).products;
  }
}

/** A lightweight product hit for the header search-autocomplete dropdown. */
export type SearchSuggestion = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  priceFils: number;
  compareAtFils: number | null;
  /** First image (cover) URL, or null when the product has no images. */
  imageUrl: string | null;
};

/**
 * Top product matches for live search suggestions. Reuses the relevance-ranked
 * search path and projects each hit to the minimal shape the dropdown needs.
 * Returns an empty list for blank/too-short queries.
 */
export async function searchSuggestions(
  q: string,
  limit = 6,
): Promise<SearchSuggestion[]> {
  if ((q?.trim().length ?? 0) < SEARCH_MIN_CHARS) return [];
  const { products } = await listProductsFiltered({
    q,
    sort: "relevance",
    take: limit,
  });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    priceFils: p.priceFils,
    compareAtFils: p.compareAtFils,
    imageUrl: p.images[0]?.url ?? null,
  }));
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
      where: { product: { isActive: true }, isArchived: false },
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

  // 3. Active products, admin-ordered; reorder best-sellers to the front.
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: DEFAULT_ORDER_BY,
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
      isArchived: false,
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
  // stock, so fully sold-out products are never recommended. Archived variants
  // are always zero-stock, so they're filtered out implicitly — but we still
  // include the flag for clarity.
  const inStock = {
    variants: { some: { stock: { gt: 0 }, isArchived: false } },
  };
  const band = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: opts.excludeId },
      priceFils: { gte: lo, lte: hi },
      ...inStock,
    },
    orderBy: { createdAt: "desc" },
    take: take * 3,
    include: { variants: activeVariantsInclude, images: { orderBy: { position: "asc" } } },
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
    include: { variants: activeVariantsInclude, images: { orderBy: { position: "asc" } } },
  });
  return [...picked, ...fill];
}

/**
 * Active products by explicit id list, returned in that exact order — powers
 * admin-curated ("manual" mode) home sections. Ids that no longer exist, are
 * inactive, or repeat are silently dropped, so a since-deleted or hidden pick
 * just disappears from the row instead of erroring.
 */
export async function getProductsByIds(
  ids: string[],
): Promise<ProductWithRelations[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    include: {
      variants: activeVariantsInclude,
      images: { orderBy: { position: "asc" } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((p): p is ProductWithRelations => Boolean(p));
}

/** PDP fetch. Returns `null` when slug doesn't exist OR product is inactive. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: activeVariantsInclude,
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
      variants: activeVariantsInclude,
      images: { orderBy: { position: "asc" } },
    },
  });
}

/** Admin list — includes inactive. Ordered to match the admin's manual sort. */
export async function listAllProductsForAdmin(
  opts: ListOpts = {},
): Promise<ProductWithRelations[]> {
  return prisma.product.findMany({
    orderBy: DEFAULT_ORDER_BY,
    take: opts.take,
    skip: opts.skip,
    include: {
      variants: activeVariantsInclude,
      images: { orderBy: { position: "asc" } },
    },
  });
}

/**
 * Normalize an arbitrary string into a valid product slug: lowercase, ASCII
 * alphanumerics, single hyphens between words, no leading/trailing hyphen.
 * Mirrors the `slugRegex` enforced by `productCreateSchema`.
 */
function normalizeSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Return a slug guaranteed not to collide with an existing product. If the
 * normalized `base` is free it's returned as-is; otherwise a numeric suffix is
 * appended (`-2`, `-3`, …) until a free one is found. Used to keep AI-suggested
 * slugs unique so a later save doesn't fail on the `Product.slug` unique index.
 *
 * `excludeId` lets an *edit* flow ignore the product's own current slug so
 * re-suggesting on an existing product doesn't needlessly bump it.
 */
export async function generateUniqueSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const normalized = normalizeSlug(base) || "product";
  const rows = await prisma.product.findMany({
    where: {
      OR: [{ slug: normalized }, { slug: { startsWith: `${normalized}-` } }],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(normalized)) return normalized;
  let n = 2;
  while (taken.has(`${normalized}-${n}`)) n++;
  return `${normalized}-${n}`;
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
        weightGrams: input.weightGrams ?? null,
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
        variants: activeVariantsInclude,
        images: { orderBy: { position: "asc" } },
      },
    });
    return product;
  }, TX_OPTS);
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
        weightGrams: input.weightGrams ?? null,
        // `undefined` leaves the column untouched; an explicit `null` clears the
        // override back to the global default; a value writes the override.
        ...(input.sizeChart === undefined
          ? {}
          : { sizeChart: input.sizeChart ?? Prisma.JsonNull }),
      },
    });

    if (input.variants) {
      // Reconcile the variant set:
      //   - Variants the admin removed (not in the incoming list): if they have
      //     no OrderItem references, hard-delete them. If they do, soft-delete
      //     (isArchived = true, stock = 0) so order history stays valid while
      //     the variant disappears from the storefront + editor.
      //   - New variants whose (colorHex, size) matches an archived row are
      //     resurrected (un-archived) instead of created, because the unique
      //     `@@unique([productId, colorHex, size])` covers archived rows too.
      const existing = await tx.productVariant.findMany({
        where: { productId: id },
        select: {
          id: true,
          colorHex: true,
          size: true,
          isArchived: true,
          _count: { select: { orderItems: true } },
        },
      });
      const existingById = new Map(existing.map((e) => [e.id, e]));
      const incomingIds = new Set(
        input.variants.map((v) => v.id).filter((x): x is string => Boolean(x)),
      );
      const removed = existing.filter((e) => !incomingIds.has(e.id));

      const toHardDelete = removed
        .filter((r) => r._count.orderItems === 0)
        .map((r) => r.id);
      const toSoftDelete = removed
        .filter((r) => r._count.orderItems > 0 && !r.isArchived)
        .map((r) => r.id);

      if (toHardDelete.length > 0) {
        await tx.productVariant.deleteMany({
          where: { id: { in: toHardDelete } },
        });
      }
      if (toSoftDelete.length > 0) {
        await tx.productVariant.updateMany({
          where: { id: { in: toSoftDelete } },
          data: { isArchived: true, stock: 0 },
        });
      }

      // Index of archived rows keyed by `(colorHex||"")::size`, for resurrecting
      // when the admin re-adds a previously-removed color+size combination.
      const archivedKey = (
        colorHex: string | null,
        size: string,
      ): string => `${(colorHex ?? "").toLowerCase()}::${size}`;
      const archivedIndex = new Map<string, string>();
      for (const e of existing) {
        if (e.isArchived) {
          archivedIndex.set(archivedKey(e.colorHex, e.size), e.id);
        }
      }

      for (const v of input.variants) {
        if (v.id && existingById.has(v.id)) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              colorNameAr: v.colorNameAr ?? null,
              colorNameEn: v.colorNameEn ?? null,
              colorHex: v.colorHex ?? null,
              size: v.size,
              stock: v.stock,
              sku: v.sku ?? null,
              // If the admin edits an archived row directly (rare, but the
              // form never surfaces them so it would only happen by id reuse),
              // surface it again.
              isArchived: false,
            },
          });
          continue;
        }

        // New variant — resurrect an archived row when the same (colorHex,
        // size) already exists, otherwise create.
        const resurrectId = archivedIndex.get(
          archivedKey(v.colorHex ?? null, v.size),
        );
        if (resurrectId) {
          await tx.productVariant.update({
            where: { id: resurrectId },
            data: {
              colorNameAr: v.colorNameAr ?? null,
              colorNameEn: v.colorNameEn ?? null,
              colorHex: v.colorHex ?? null,
              size: v.size,
              stock: v.stock,
              sku: v.sku ?? null,
              isArchived: false,
            },
          });
          archivedIndex.delete(archivedKey(v.colorHex ?? null, v.size));
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
        variants: activeVariantsInclude,
        images: { orderBy: { position: "asc" } },
      },
    });
    return updated;
  }, TX_OPTS);
}

/**
 * Persist a new manual display order from a drag-and-drop reorder. `ids` is
 * the full ordered list as the admin now wants it (index 0 = shows first);
 * each product's `sortOrder` is set to its index. Runs as a transaction so a
 * page reload never observes a half-applied order.
 */
export async function reorderProducts(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.product.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
    TX_OPTS,
  );
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

  // 3. Active products with full relations, admin-ordered; reorder sellers up.
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: DEFAULT_ORDER_BY,
    include: {
      variants: activeVariantsInclude,
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
