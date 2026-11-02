import { prisma, type Prisma } from "@workspace/db";
import type { Category } from "@workspace/db";

import type { CategoryWriteInput } from "@/lib/schemas/category.schema";

/** Same budget as product writes — bulk link rewrites go over the Neon pooler. */
const TX_OPTS = { timeout: 30_000, maxWait: 10_000 } as const;

/** Admin display order: manual sortOrder, then English name. */
const CATEGORY_ORDER_BY: Prisma.CategoryOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { nameEn: "asc" },
];

export type CategoryWithCount = Category & { productCount: number };

/** Every category (active or not) with how many products it holds. */
export async function listCategoriesForAdmin(): Promise<CategoryWithCount[]> {
  const rows = await prisma.category.findMany({
    orderBy: CATEGORY_ORDER_BY,
    include: { _count: { select: { products: true } } },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}

/** Lightweight option list for pickers (e.g. the product form). */
export type CategoryOption = Pick<
  Category,
  "id" | "slug" | "nameEn" | "nameAr" | "isActive"
>;

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  return prisma.category.findMany({
    orderBy: CATEGORY_ORDER_BY,
    select: { id: true, slug: true, nameEn: true, nameAr: true, isActive: true },
  });
}

/** One category plus the ids of the products assigned to it. */
export async function getCategoryWithProductIds(
  id: string,
): Promise<(Category & { productIds: string[] }) | null> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { products: { select: { productId: true } } },
  });
  if (!category) return null;
  const { products, ...rest } = category;
  return { ...rest, productIds: products.map((p) => p.productId) };
}

/** Ids of the categories a product belongs to. */
export async function listCategoryIdsForProduct(productId: string): Promise<string[]> {
  const links = await prisma.productCategory.findMany({
    where: { productId },
    select: { categoryId: true },
  });
  return links.map((l) => l.categoryId);
}

export async function createCategory(input: CategoryWriteInput): Promise<Category> {
  // New categories go to the end of the list.
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return prisma.category.create({
    data: { ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
}

export async function updateCategory(
  id: string,
  input: CategoryWriteInput,
): Promise<Category> {
  return prisma.category.update({ where: { id }, data: input });
}

/** Hard delete. Product links cascade; the products themselves are untouched. */
export async function deleteCategory(id: string): Promise<void> {
  await prisma.category.delete({ where: { id } });
}

/** Persist a drag/arrow reorder. `ids` is the full new order, top to bottom. */
export async function reorderCategories(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.category.update({ where: { id }, data: { sortOrder: index } }),
    ),
    TX_OPTS,
  );
}

/**
 * Replace the full product set of a category: unlinks products not in
 * `productIds`, links the new ones, leaves existing links (and their
 * createdAt) alone. Unknown product ids are ignored.
 */
export async function setCategoryProducts(
  categoryId: string,
  productIds: string[],
): Promise<void> {
  const unique = [...new Set(productIds)];
  await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    const valid = existing.map((p) => p.id);
    await tx.productCategory.deleteMany({
      where: { categoryId, productId: { notIn: valid } },
    });
    if (valid.length > 0) {
      await tx.productCategory.createMany({
        data: valid.map((productId) => ({ productId, categoryId })),
        skipDuplicates: true,
      });
    }
  }, TX_OPTS);
}

/**
 * Replace the full category set of a product. Accepts a transaction client so
 * product create/update can link categories atomically with the product write.
 */
export async function setProductCategories(
  productId: string,
  categoryIds: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  const unique = [...new Set(categoryIds)];
  const existing = await db.category.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  const valid = existing.map((c) => c.id);
  await db.productCategory.deleteMany({
    where: { productId, categoryId: { notIn: valid } },
  });
  if (valid.length > 0) {
    await db.productCategory.createMany({
      data: valid.map((categoryId) => ({ productId, categoryId })),
      skipDuplicates: true,
    });
  }
}

/** Compact product row for the category's product picker. */
export type PickerProduct = {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
  isActive: boolean;
  thumbnailUrl: string | null;
};

/** All products (incl. hidden), in the admin's manual order, for picking. */
export async function listProductsForPicker(): Promise<PickerProduct[]> {
  const rows = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      slug: true,
      isActive: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  });
  return rows.map(({ images, ...p }) => ({
    ...p,
    thumbnailUrl: images[0]?.url ?? null,
  }));
}

/* ------------------------------------------------------------------ */
/* Storefront                                                          */
/* ------------------------------------------------------------------ */

/** What the storefront needs to render a category link / chip. */
export type StorefrontCategory = Pick<
  Category,
  "id" | "slug" | "nameEn" | "nameAr"
>;

const STOREFRONT_SELECT = {
  id: true,
  slug: true,
  nameEn: true,
  nameAr: true,
} as const;

/** Visible AND holding at least one visible product — never show an empty category. */
const SHOPPABLE: Prisma.CategoryWhereInput = {
  isActive: true,
  products: { some: { product: { isActive: true } } },
};

/** Categories offered in the shop-page filter. */
export async function listShoppableCategories(): Promise<StorefrontCategory[]> {
  return prisma.category.findMany({
    where: SHOPPABLE,
    orderBy: CATEGORY_ORDER_BY,
    select: STOREFRONT_SELECT,
  });
}

/** Categories the admin marked "Show in menu" (header dropdown + mobile menu). */
export async function listMenuCategories(): Promise<StorefrontCategory[]> {
  return prisma.category.findMany({
    where: { ...SHOPPABLE, showInMenu: true },
    orderBy: CATEGORY_ORDER_BY,
    select: STOREFRONT_SELECT,
  });
}

/** A visible category by slug, for its storefront page. Null when hidden/missing. */
export async function getVisibleCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const category = await prisma.category.findUnique({ where: { slug } });
  return category?.isActive ? category : null;
}

/** A product's visible categories (product-page chips + related products). */
export async function listVisibleCategoriesForProduct(
  productId: string,
): Promise<StorefrontCategory[]> {
  return prisma.category.findMany({
    where: { isActive: true, products: { some: { productId } } },
    orderBy: CATEGORY_ORDER_BY,
    select: STOREFRONT_SELECT,
  });
}
