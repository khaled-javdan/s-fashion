import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { PaymentMethod } from "@workspace/db"

import type { OrderWithItems } from "@/lib/repos/orders.repo"
import { formatAed } from "@/lib/money"
import type { Locale } from "@/lib/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { OrderStatusBadge } from "./order-status-badge"
import { formatDestination } from "./emirate"
import { relativeTime } from "./relative-time"

export async function OrdersTable({
  orders,
  locale,
}: {
  orders: OrderWithItems[]
  locale: Locale
}) {
  const t = await getTranslations("admin.orders")

  if (orders.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-12 text-center text-sm">
        {t("table.empty")}
      </div>
    )
  }

  const base = `/${locale}/admin/orders`

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.order_number")}</TableHead>
            <TableHead>{t("table.customer")}</TableHead>
            <TableHead>{t("table.phone")}</TableHead>
            <TableHead>{t("table.emirate")}</TableHead>
            <TableHead className="text-end">{t("table.total")}</TableHead>
            <TableHead>{t("table.payment")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead className="text-end">{t("table.created")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <Link
                  href={`${base}/${order.id}`}
                  className="font-mono font-medium underline-offset-4 hover:underline"
                >
                  {order.orderNumber}
                </Link>
              </TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell className="font-mono text-xs" dir="ltr">
                {order.phone}
              </TableCell>
              <TableCell>
                {formatDestination(order.country, order.emirate)}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatAed(order.totalFils, "en")}
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground text-xs">
                  {order.paymentMethod === PaymentMethod.STRIPE
                    ? t("table.payment_card")
                    : t("table.payment_cod")}
                </span>
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="text-muted-foreground text-end text-xs">
                {relativeTime(order.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
