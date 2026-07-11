import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import type { ProductPerformanceRow } from "@/lib/repos/orders.repo"
import { formatAed } from "@/lib/money"
import type { Locale } from "@/lib/locale"

/**
 * Ranked product-performance table (server component). One row per product,
 * pre-sorted by units sold; the leftmost column shows that rank. Colour +
 * size breakdown for that product is pooled into a single "Variants" cell
 * rather than split across rows. Name/colour/size come from the order-item
 * snapshot so archived or deleted variants still appear; thumbnail, colour
 * swatch, and link are present only while the product still exists in the
 * catalogue.
 */
export async function ProductPerformanceTable({
  rows,
  locale,
}: {
  rows: ProductPerformanceRow[]
  locale: Locale
}) {
  const t = await getTranslations("admin.analytics")

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-12 text-center text-sm">
        {t("no_sales")}
      </div>
    )
  }

  const base = `/${locale}/admin/products`

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead className="w-16"></TableHead>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("variant")}</TableHead>
            <TableHead className="text-end">{t("units_sold")}</TableHead>
            <TableHead className="text-end">{t("orders")}</TableHead>
            <TableHead className="text-end">{t("revenue")}</TableHead>
            <TableHead className="text-end">{t("gross_profit")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const name = locale === "ar" ? row.nameAr : row.nameEn
            return (
              <TableRow key={row.productId ?? `${row.nameEn}:${row.nameAr}`}>
                <TableCell className="text-muted-foreground text-center tabular-nums">
                  {i + 1}
                </TableCell>
                <TableCell>
                  {row.imageUrl ? (
                    <span className="bg-muted relative block size-12 shrink-0 overflow-hidden rounded-md border">
                      <Image
                        src={row.imageUrl}
                        alt={name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </span>
                  ) : (
                    <span
                      className="bg-muted flex size-12 items-center justify-center rounded-md border text-xs font-medium"
                      aria-hidden
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {row.slug ? (
                    <Link
                      href={`${base}/${row.productId}`}
                      className="font-medium whitespace-normal underline-offset-4 hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className="font-medium whitespace-normal">{name}</span>
                  )}
                  {!row.isActive ? (
                    <span className="text-muted-foreground ms-2 text-[10px] font-semibold uppercase tracking-widest">
                      {t("product_inactive")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {row.variants.map((v) => {
                      const colorName =
                        locale === "ar" ? v.colorNameAr : v.colorNameEn
                      const label = [colorName, v.size].filter(Boolean).join(" · ")
                      return (
                        <span
                          key={v.variantId}
                          className="bg-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap"
                        >
                          {v.colorHex ? (
                            <span
                              className="inline-block size-2.5 shrink-0 rounded-full border"
                              style={{ backgroundColor: v.colorHex }}
                              aria-hidden
                            />
                          ) : null}
                          {label || v.size}
                          <span className="text-muted-foreground">×{v.units}</span>
                        </span>
                      )
                    })}
                  </span>
                </TableCell>
                <TableCell className="text-end font-semibold tabular-nums">
                  {row.units}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {row.orders}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatAed(row.revenueFils, locale)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatAed(row.profitFils, locale)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
