import { prisma, Prisma } from "@workspace/db";
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
        priceFils: input.priceFils,
        compareAtFils: input.compareAtFils ?? null,
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
        priceFils: input.priceFils,
        compareAtFils: input.compareAtFils,
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
