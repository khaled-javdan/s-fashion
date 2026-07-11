import { getTranslations } from "next-intl/server"

import { OrderStatus } from "@workspace/db"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

/** Colour treatment for each order status (labels are localised via next-intl). */
const STATUS_CLASS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_VERIFICATION]:
    "border-transparent bg-muted text-muted-foreground",
  [OrderStatus.AWAITING_PAYMENT]:
    "border-transparent bg-purple-100 text-purple-800",
  [OrderStatus.NEW]: "border-transparent bg-blue-100 text-blue-800",
  [OrderStatus.CONFIRMED]: "border-transparent bg-amber-100 text-amber-900",
  [OrderStatus.SHIPPED]: "border-transparent bg-indigo-100 text-indigo-800",
  [OrderStatus.DELIVERED]: "border-transparent bg-green-100 text-green-800",
  [OrderStatus.REFUSED]: "border-transparent bg-red-100 text-red-800",
  [OrderStatus.CANCELLED]: "border-transparent bg-zinc-200 text-zinc-700",
}

export async function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus
  className?: string
}) {
  const t = await getTranslations("admin.orders")
  // Track E's Badge zeroes padding/background in its base styles, so we
  // re-establish a pill shape here in addition to the status colour.
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2 py-0.5", STATUS_CLASS[status], className)}
    >
      {t(`status.${status}`)}
    </Badge>
  )
}
