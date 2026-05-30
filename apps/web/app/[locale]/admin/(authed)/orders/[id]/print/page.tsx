import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { AutoPrint } from "@/components/admin/orders/auto-print"
import { formatDestination } from "@/components/admin/orders/emirate"
import { formatAed } from "@/lib/money"
import { getOrderById } from "@/lib/repos/orders.repo"

export default async function OrderPrintPage({
  params,
}: PageProps<"/[locale]/admin/orders/[id]/print">) {
  const { id } = await params
  const t = await getTranslations("admin.orders")

  const order = await getOrderById(id)
  if (!order) {
    notFound()
  }

  const addressLines = [
    order.addressLine1,
    order.addressLine2,
    `${order.city}, ${formatDestination(order.country, order.emirate)}`,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6 text-black">
      <AutoPrint />

      {/* Header: brand + order number in large monospace (in lieu of a QR code). */}
      <div className="flex items-start justify-between border-b border-black pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em]">
            S Fashion
          </div>
          <div className="text-sm">{t("print.hand_off")}</div>
        </div>
        <div className="text-end">
          <div className="text-[10px] uppercase tracking-widest">
            {t("print.order_number")}
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight">
            {order.orderNumber}
          </div>
        </div>
      </div>

      {/* Customer + delivery — large and clear for the courier. */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-widest">
          {t("print.deliver_to")}
        </div>
        <div className="text-xl font-semibold">{order.customerName}</div>
        <div className="font-mono text-lg" dir="ltr">
          {order.phone}
        </div>
        <div className="text-base leading-relaxed">
          {addressLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      {order.notes ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest">
            {t("print.notes")}
          </div>
          <div className="text-sm whitespace-pre-wrap">{order.notes}</div>
        </div>
      ) : null}

      {/* Items */}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-widest">
          {t("print.items")}
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black text-start">
              <th className="py-1 text-start font-medium">
                {t("table.item")}
              </th>
              <th className="py-1 text-start font-medium">
                {t("table.size")}
              </th>
              <th className="py-1 text-end font-medium">{t("table.qty")}</th>
              <th className="py-1 text-end font-medium">{t("table.total")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-black/30">
                <td className="py-1.5">
                  {item.productNameEn}
                  {item.colorNameEn ? ` · ${item.colorNameEn}` : ""}
                </td>
                <td className="py-1.5">{item.size}</td>
                <td className="py-1.5 text-end tabular-nums">
                  {item.quantity}
                </td>
                <td className="py-1.5 text-end tabular-nums">
                  {formatAed(item.unitPriceFils * item.quantity, "en")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals — cash on delivery. */}
      <div className="ms-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span>{t("detail.subtotal")}</span>
          <span className="tabular-nums">
            {formatAed(order.subtotalFils, "en")}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t("detail.shipping")}</span>
          <span className="tabular-nums">
            {order.shippingFils === 0
              ? t("detail.free")
              : formatAed(order.shippingFils, "en")}
          </span>
        </div>
        <div className="flex justify-between border-t border-black pt-1 text-lg font-bold">
          <span>{t("print.collect_cod")}</span>
          <span className="tabular-nums">
            {formatAed(order.totalFils, "en")}
          </span>
        </div>
      </div>
    </div>
  )
}
