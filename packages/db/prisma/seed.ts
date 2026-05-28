/**
 * Idempotent database seed.
 *
 * Inserts (or upserts) 5 demo products with 2-3 variants and 3 images each,
 * plus the Setting rows specified in SPEC §4. Safe to re-run.
 *
 * Run: pnpm -F @workspace/db exec prisma db seed
 */
// Import from the locally generated client (see src/index.ts for why).
// Env loading (DATABASE_URL / DIRECT_URL) is handled by `prisma.config.ts`,
// which the Prisma CLI loads before spawning this script.
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient, Size } from "../node_modules/.prisma/client/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (seed).");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

type SeedVariant = {
  colorNameAr: string;
  colorNameEn: string;
  colorHex: string;
  size: Size;
  stock: number;
  sku: string;
};

type SeedImage = {
  url: string;
  altAr: string;
  altEn: string;
  position: number;
};

type SeedProduct = {
  slug: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  priceFils: number;
  compareAtFils: number | null;
  isFinalSale: boolean;
  variants: SeedVariant[];
  images: SeedImage[];
};

// Unsplash placeholder URLs (free-to-use). w=1200 keeps files reasonable.
const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const products: SeedProduct[] = [
  {
    slug: "mukhawar-rose-gold",
    nameAr: "مخور وردي ذهبي",
    nameEn: "Rose Gold Mukhawar",
    descAr:
      "مخور كلاسيكي بلمسة عصرية، مطرز يدوياً بخيوط ذهبية على قماش ناعم مريح يناسب المناسبات.",
    descEn:
      "A classic mukhawar with a modern twist — hand-embroidered with gold thread on soft, breathable fabric.",
    priceFils: 45000,
    compareAtFils: 55000,
    isFinalSale: false,
    variants: [
      {
        colorNameAr: "وردي",
        colorNameEn: "Rose",
        colorHex: "#C97B84",
        size: Size.S,
        stock: 8,
        sku: "MK-ROSE-S",
      },
      {
        colorNameAr: "وردي",
        colorNameEn: "Rose",
        colorHex: "#C97B84",
        size: Size.M,
        stock: 12,
        sku: "MK-ROSE-M",
      },
      {
        colorNameAr: "وردي",
        colorNameEn: "Rose",
        colorHex: "#C97B84",
        size: Size.L,
        stock: 5,
        sku: "MK-ROSE-L",
      },
    ],
    images: [
      {
        url: img("1490481651871-ab68de25d43d"),
        altAr: "مخور وردي ذهبي - أمام",
        altEn: "Rose Gold Mukhawar - front",
        position: 0,
      },
      {
        url: img("1539109136881-3be0616acf4b"),
        altAr: "مخور وردي ذهبي - تفاصيل",
        altEn: "Rose Gold Mukhawar - detail",
        position: 1,
      },
      {
        url: img("1515886657613-9f3515b0c78f"),
        altAr: "مخور وردي ذهبي - ظهر",
        altEn: "Rose Gold Mukhawar - back",
        position: 2,
      },
    ],
  },
  {
    slug: "mukhawar-midnight-blue",
    nameAr: "مخور أزرق ليلي",
    nameEn: "Midnight Blue Mukhawar",
    descAr:
      "أزرق عميق مع تطريز فضي يلمع تحت الإضاءة، خيار راقي لسهرات الأعراس والمناسبات الخاصة.",
    descEn:
      "Deep midnight blue with silver embroidery that catches the light — perfect for weddings and special evenings.",
    priceFils: 52000,
    compareAtFils: null,
    isFinalSale: false,
    variants: [
      {
        colorNameAr: "أزرق ليلي",
        colorNameEn: "Midnight Blue",
        colorHex: "#1B2A4A",
        size: Size.M,
        stock: 10,
        sku: "MK-MID-M",
      },
      {
        colorNameAr: "أزرق ليلي",
        colorNameEn: "Midnight Blue",
        colorHex: "#1B2A4A",
        size: Size.L,
        stock: 7,
        sku: "MK-MID-L",
      },
    ],
    images: [
      {
        url: img("1483985988355-763728e1935b"),
        altAr: "مخور أزرق ليلي - أمام",
        altEn: "Midnight Blue Mukhawar - front",
        position: 0,
      },
      {
        url: img("1496747611176-843222e1e57c"),
        altAr: "مخور أزرق ليلي - تفاصيل",
        altEn: "Midnight Blue Mukhawar - detail",
        position: 1,
      },
      {
        url: img("1469334031218-e382a71b716b"),
        altAr: "مخور أزرق ليلي - ظهر",
        altEn: "Midnight Blue Mukhawar - back",
        position: 2,
      },
    ],
  },
  {
    slug: "mukhawar-emerald-classic",
    nameAr: "مخور أخضر زمردي",
    nameEn: "Emerald Classic Mukhawar",
    descAr:
      "اللون الأخضر الزمردي الفاخر مع تفاصيل تطريز ذهبية كلاسيكية تليق بالمناسبات الراقية.",
    descEn:
      "Luxurious emerald green with classic gold embroidery, designed for elegant occasions.",
    priceFils: 48000,
    compareAtFils: 58000,
    isFinalSale: false,
    variants: [
      {
        colorNameAr: "أخضر زمردي",
        colorNameEn: "Emerald",
        colorHex: "#0E5448",
        size: Size.S,
        stock: 6,
        sku: "MK-EMR-S",
      },
      {
        colorNameAr: "أخضر زمردي",
        colorNameEn: "Emerald",
        colorHex: "#0E5448",
        size: Size.M,
        stock: 9,
        sku: "MK-EMR-M",
      },
      {
        colorNameAr: "أخضر زمردي",
        colorNameEn: "Emerald",
        colorHex: "#0E5448",
        size: Size.L,
        stock: 4,
        sku: "MK-EMR-L",
      },
    ],
    images: [
      {
        url: img("1469334031218-e382a71b716b"),
        altAr: "مخور أخضر زمردي - أمام",
        altEn: "Emerald Mukhawar - front",
        position: 0,
      },
      {
        url: img("1572804013427-4d7ca7268217"),
        altAr: "مخور أخضر زمردي - تفاصيل",
        altEn: "Emerald Mukhawar - detail",
        position: 1,
      },
      {
        url: img("1495121605193-b116b5b9c5fe"),
        altAr: "مخور أخضر زمردي - ظهر",
        altEn: "Emerald Mukhawar - back",
        position: 2,
      },
    ],
  },
  {
    slug: "mukhawar-ivory-pearl",
    nameAr: "مخور عاجي بلؤلؤ",
    nameEn: "Ivory Pearl Mukhawar",
    descAr:
      "لون عاجي ناعم مزين بحبات اللؤلؤ والتطريز الفضي، مثالي للمناسبات النهارية والأعراس.",
    descEn:
      "Soft ivory adorned with pearl beading and silver embroidery — perfect for daytime celebrations and weddings.",
    priceFils: 65000,
    compareAtFils: null,
    isFinalSale: false,
    variants: [
      {
        colorNameAr: "عاجي",
        colorNameEn: "Ivory",
        colorHex: "#F2E8D5",
        size: Size.S,
        stock: 5,
        sku: "MK-IVR-S",
      },
      {
        colorNameAr: "عاجي",
        colorNameEn: "Ivory",
        colorHex: "#F2E8D5",
        size: Size.M,
        stock: 8,
        sku: "MK-IVR-M",
      },
      {
        colorNameAr: "عاجي",
        colorNameEn: "Ivory",
        colorHex: "#F2E8D5",
        size: Size.L,
        stock: 3,
        sku: "MK-IVR-L",
      },
    ],
    images: [
      {
        url: img("1490481651871-ab68de25d43d"),
        altAr: "مخور عاجي - أمام",
        altEn: "Ivory Pearl Mukhawar - front",
        position: 0,
      },
      {
        url: img("1485518882345-15568b007407"),
        altAr: "مخور عاجي - تفاصيل اللؤلؤ",
        altEn: "Ivory Pearl Mukhawar - pearl detail",
        position: 1,
      },
      {
        url: img("1496747611176-843222e1e57c"),
        altAr: "مخور عاجي - ظهر",
        altEn: "Ivory Pearl Mukhawar - back",
        position: 2,
      },
    ],
  },
  {
    slug: "mukhawar-burgundy-velvet",
    nameAr: "مخور خمري مخمل",
    nameEn: "Burgundy Velvet Mukhawar",
    descAr:
      "قطعة محدودة بقماش المخمل الخمري الفاخر مع تطريز نحاسي، تصلح لشتاء الإمارات الدافئ.",
    descEn:
      "A limited piece in luxurious burgundy velvet with copper-thread embroidery — made for warm Emirati winters.",
    priceFils: 72000,
    compareAtFils: 85000,
    isFinalSale: true,
    variants: [
      {
        colorNameAr: "خمري",
        colorNameEn: "Burgundy",
        colorHex: "#5C1A2B",
        size: Size.M,
        stock: 4,
        sku: "MK-BRG-M",
      },
      {
        colorNameAr: "خمري",
        colorNameEn: "Burgundy",
        colorHex: "#5C1A2B",
        size: Size.L,
        stock: 3,
        sku: "MK-BRG-L",
      },
    ],
    images: [
      {
        url: img("1483985988355-763728e1935b"),
        altAr: "مخور خمري مخمل - أمام",
        altEn: "Burgundy Velvet Mukhawar - front",
        position: 0,
      },
      {
        url: img("1515886657613-9f3515b0c78f"),
        altAr: "مخور خمري مخمل - تفاصيل المخمل",
        altEn: "Burgundy Velvet Mukhawar - velvet detail",
        position: 1,
      },
      {
        url: img("1539109136881-3be0616acf4b"),
        altAr: "مخور خمري مخمل - ظهر",
        altEn: "Burgundy Velvet Mukhawar - back",
        position: 2,
      },
    ],
  },
];

const settings: { key: string; value: unknown }[] = [
  { key: "shipping.flat_fils", value: 2500 },
  { key: "shipping.free_threshold_fils", value: 60000 },
  { key: "contact.whatsapp_number", value: "+971501234567" },
  {
    key: "contact.business_hours_ar",
    value: "السبت – الخميس، 10ص – 10م",
  },
  { key: "contact.business_hours_en", value: "Sat–Thu, 10am – 10pm" },
  {
    key: "size_chart.cm",
    value: {
      unit: "cm",
      rows: [
        { size: "XS", bust: 80, waist: 62, hips: 86, length: 140 },
        { size: "S", bust: 84, waist: 66, hips: 90, length: 142 },
        { size: "M", bust: 88, waist: 70, hips: 94, length: 144 },
        { size: "L", bust: 94, waist: 76, hips: 100, length: 146 },
        { size: "XL", bust: 100, waist: 82, hips: 106, length: 148 },
        { size: "XXL", bust: 106, waist: 88, hips: 112, length: 150 },
        {
          size: "FREE",
          bust: null,
          waist: null,
          hips: null,
          length: 146,
        },
      ],
    },
  },
  { key: "order.max_items", value: 5 },
  { key: "order.max_qty_per_variant", value: 2 },
];

async function seedSettings() {
  for (const { key, value } of settings) {
    await prisma.setting.upsert({
      where: { key },
      // Casting through unknown because Setting.value is Prisma.JsonValue —
      // upsert accepts our union (number | string | object) at runtime.
      update: { value: value as never },
      create: { key, value: value as never },
    });
  }
  console.log(`✓ seeded ${settings.length} settings`);
}

async function seedProducts() {
  for (const p of products) {
    // Upsert the product first (no nested writes — variants/images use composite
    // keys / position-based upserts so the seed is idempotent).
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descAr: p.descAr,
        descEn: p.descEn,
        priceFils: p.priceFils,
        compareAtFils: p.compareAtFils,
        isFinalSale: p.isFinalSale,
        isActive: true,
      },
      create: {
        slug: p.slug,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descAr: p.descAr,
        descEn: p.descEn,
        priceFils: p.priceFils,
        compareAtFils: p.compareAtFils,
        isFinalSale: p.isFinalSale,
        isActive: true,
      },
    });

    // Variants — keyed by (productId, colorHex, size) which is the @@unique.
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: {
          productId_colorHex_size: {
            productId: product.id,
            colorHex: v.colorHex,
            size: v.size,
          },
        },
        update: {
          colorNameAr: v.colorNameAr,
          colorNameEn: v.colorNameEn,
          stock: v.stock,
          sku: v.sku,
        },
        create: {
          productId: product.id,
          colorNameAr: v.colorNameAr,
          colorNameEn: v.colorNameEn,
          colorHex: v.colorHex,
          size: v.size,
          stock: v.stock,
          sku: v.sku,
        },
      });
    }

    // Images — there is no unique constraint on ProductImage; to stay idempotent
    // we clear and re-insert images for this product. Safe because images carry
    // no foreign-key references from other tables.
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.images.map((i) => ({
        productId: product.id,
        url: i.url,
        altAr: i.altAr,
        altEn: i.altEn,
        position: i.position,
      })),
    });
  }
  console.log(`✓ seeded ${products.length} products`);
}

async function main() {
  console.log("→ seeding database...");
  await seedSettings();
  await seedProducts();
  console.log("✓ seed complete");
}

main()
  .catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
