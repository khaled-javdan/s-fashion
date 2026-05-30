import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import {
  ProductsTable,
  type ProductRow,
} from "@/components/admin/products/products-table"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"
import { listAllProductsForAdmin } from "@/lib/repos/products.repo"

const PAGE_SIZE = 50

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.products")

  const products = await listAllProductsForAdmin({ take: PAGE_SIZE })

  const rows: ProductRow[] = products.map((p) => {
    const firstImage = p.images[0]
    return {
      id: p.id,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      slug: p.slug,
      priceFils: p.priceFils,
      isActive: p.isActive,
      totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
      thumbnailUrl: firstImage?.url ?? null,
      thumbnailAlt: firstImage?.altEn ?? p.nameEn,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl">{t("list.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("list.count", { count: rows.length })}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/admin/products/new`}>{t("list.new")}</Link>
        </Button>
      </div>

      <ProductsTable products={rows} locale={locale} />
    </div>
  )
}
