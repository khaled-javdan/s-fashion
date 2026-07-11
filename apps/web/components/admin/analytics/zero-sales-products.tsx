import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import type { ZeroSaleProduct } from "@/lib/repos/orders.repo"
import type { Locale } from "@/lib/locale"

/**
 * Compact grid of active products that sold nothing in the window — not one of
 * their variants moved (dead stock for the period). Rolled up to the product
 * so a large catalogue stays scannable. Each tile links to the product's admin
 * edit page; a "+N more" note reports the true total when the list is capped.
 */
export async function ZeroSalesProducts({
  products,
  total,
  locale,
}: {
  products: ZeroSaleProduct[]
  total: number
  locale: Locale
}) {
  const t = await getTranslations("admin.analytics")

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("zero_sales_none")}</p>
    )
  }

  const base = `/${locale}/admin/products`
  const remaining = total - products.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => {
          const name = locale === "ar" ? p.nameAr : p.nameEn
          return (
            <Link
              key={p.productId}
              href={`${base}/${p.productId}`}
              className="hover:border-foreground/30 flex items-center gap-3 rounded-md border p-2 transition-colors"
            >
              {p.imageUrl ? (
                <span className="bg-muted relative size-10 shrink-0 overflow-hidden rounded border">
                  <Image
                    src={p.imageUrl}
                    alt={name}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </span>
              ) : (
                <span
                  className="bg-muted flex size-10 shrink-0 items-center justify-center rounded border text-xs font-medium"
                  aria-hidden
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {t("zero_sales_variant_count", { count: p.variantCount })}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
      {remaining > 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("zero_sales_more", { count: remaining })}
        </p>
      ) : null}
    </div>
  )
}
