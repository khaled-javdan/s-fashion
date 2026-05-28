import { PrismaNeon } from "@prisma/adapter-neon"

import { PrismaClient } from "../node_modules/.prisma/client/index.js"

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL is not set.")

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
})

async function main() {
  const [products, variants, images, orders, orderItems, admins, settings, otp] =
    await Promise.all([
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.productImage.count(),
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.adminUser.count(),
      prisma.setting.count(),
      prisma.otpAttempt.count(),
    ])

  console.log("\n=== Row counts ===")
  console.log({
    products,
    variants,
    images,
    orders,
    orderItems,
    admins,
    settings,
    otp,
  })

  const sample = await prisma.product.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      variants: { select: { size: true, colorHex: true, stock: true } },
      images: { select: { url: true, position: true }, orderBy: { position: "asc" } },
    },
  })

  console.log("\n=== Products (most recent 5) ===")
  for (const p of sample) {
    console.log(`\n[${p.slug}] ${p.nameEn} — ${(p.priceFils / 100).toFixed(2)} AED  (active=${p.isActive})`)
    console.log(`  variants: ${p.variants.length}`)
    for (const v of p.variants) {
      console.log(`    • size=${v.size}  color=${v.colorHex ?? "-"}  stock=${v.stock}`)
    }
    console.log(`  images:   ${p.images.length}`)
  }

  const adminList = await prisma.adminUser.findMany({
    select: { email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  console.log("\n=== Admins ===")
  for (const a of adminList) {
    console.log(`  ${a.role.padEnd(5)}  ${a.email.padEnd(30)}  ${a.name}`)
  }

  const settingRows = await prisma.setting.findMany({ orderBy: { key: "asc" } })
  console.log("\n=== Settings ===")
  for (const s of settingRows) {
    console.log(`  ${s.key.padEnd(34)}  ${JSON.stringify(s.value)}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
