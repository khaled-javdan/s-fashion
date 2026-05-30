import { getTranslations } from "next-intl/server"

import type { OrderItem } from "@workspace/db"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { formatAed } from "@/lib/money"

/**
 * Order items are immutable snapshots (no image FK), so we render a small
 * colour-swatch / initial placeholder rather than a product thumbnail.
 */
export async function OrderItemsTable({ items }: { items: OrderItem[] }) {
  const t = await getTranslations("admin.orders")
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>{t("table.item")}</TableHead>
            <TableHead>{t("table.size")}</TableHead>
            <TableHead className="text-end">{t("table.qty")}</TableHead>
            <TableHead className="text-end">{t("table.unit")}</TableHead>
            <TableHead className="text-end">{t("table.total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span
                  className="bg-muted flex size-9 items-center justify-center rounded-md border text-xs font-medium"
                  aria-hidden
                >
                  {item.productNameEn.slice(0, 1).toUpperCase()}
                </span>
              </TableCell>
              <TableCell>
                <div className="font-medium whitespace-normal">
                  {item.productNameEn}
                </div>
                {item.colorNameEn ? (
                  <div className="text-muted-foreground text-xs">
                    {item.colorNameEn}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>{item.size}</TableCell>
              <TableCell className="text-end tabular-nums">
                {item.quantity}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatAed(item.unitPriceFils, "en")}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatAed(item.unitPriceFils * item.quantity, "en")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
