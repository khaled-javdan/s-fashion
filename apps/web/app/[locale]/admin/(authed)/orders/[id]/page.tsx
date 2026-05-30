import { Printer } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@workspace/ui/components/button"

import { CustomerBlock } from "@/components/admin/orders/customer-block"
import { formatEmirate } from "@/components/admin/orders/emirate"
import { OrderItemsTable } from "@/components/admin/orders/order-items-table"
import { OrderStatusActions } from "@/components/admin/orders/order-status-actions"
import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge"
import { OrderTimeline } from "@/components/admin/orders/order-timeline"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"
import { formatAed } from "@/lib/money"
import { getOrderById } from "@/lib/repos/orders.repo"

export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/[locale]/admin/orders/[id]">) {
  const { locale: localeParam, id } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE

  const t = await getTranslations("admin.orders")

  const order = await getOrderById(id)
  if (!order) {
    notFound()
  }

  const base = `/${locale}/admin/orders`
  const whatsappText = t("detail.whatsapp_message", {
    name: order.customerName,
    orderNumber: order.orderNumber,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={base}
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            {t("detail.back")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-mono text-3xl">
              {order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={`${base}/${order.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer className="size-4" />
              {t("detail.print")}
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Start column: customer + items */}
        <div className="space-y-6 lg:col-span-2">
          <CustomerBlock
            name={order.customerName}
            phone={order.phone}
            email={order.email}
            emirate={formatEmirate(order.emirate)}
            city={order.city}
            addressLine1={order.addressLine1}
            addressLine2={order.addressLine2}
            whatsappText={whatsappText}
          />

          {order.notes ? (
            <div className="bg-card text-card-foreground space-y-2 rounded-md border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {t("detail.notes")}
              </h2>
              <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
            </div>
          ) : null}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {t("detail.items")}
            </h2>
            <OrderItemsTable items={order.items} />
          </div>
        </div>

        {/* End column: totals + actions + timeline */}
        <div className="space-y-6">
          <div className="bg-card text-card-foreground space-y-3 rounded-md border p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {t("detail.summary")}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t("detail.subtotal")}</dt>
                <dd className="tabular-nums">
                  {formatAed(order.subtotalFils, "en")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t("detail.shipping")}</dt>
                <dd className="tabular-nums">
                  {order.shippingFils === 0
                    ? t("detail.free")
                    : formatAed(order.shippingFils, "en")}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t pt-2 font-medium">
                <dt>{t("detail.total_cod")}</dt>
                <dd className="tabular-nums">
                  {formatAed(order.totalFils, "en")}
                </dd>
              </div>
            </dl>
          </div>

          <OrderStatusActions orderId={order.id} status={order.status} />

          <OrderTimeline events={order.events} />
        </div>
      </div>
    </div>
  )
}
