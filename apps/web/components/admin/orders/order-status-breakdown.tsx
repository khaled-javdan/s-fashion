import { getTranslations } from "next-intl/server"

import { cn } from "@workspace/ui/lib/utils"

import { STATUS_CLASS } from "@/components/admin/orders/order-status-badge"
import type { OrderStatusCounts } from "@/lib/repos/orders.repo"

/**
 * Status-coloured count pills ("3 New · 1 Cancelled …") so a windowed order
 * total never hides cancellations / refusals.
 */
export async function OrderStatusBreakdown({
  counts,
  hideZero = false,
  className,
}: {
  counts: OrderStatusCounts
  hideZero?: boolean
  className?: string
}) {
  const t = await getTranslations("admin.orders")
  const entries = (
    Object.entries(counts) as [keyof OrderStatusCounts, number][]
  ).filter(([, n]) => !hideZero || n > 0)
  if (entries.length === 0) return null

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {entries.map(([status, n]) => (
        <li
          key={status}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_CLASS[status],
            n === 0 && "opacity-50"
          )}
        >
          <span className="font-semibold tabular-nums">{n}</span>
          {t(`status.${status}`)}
        </li>
      ))}
    </ul>
  )
}
