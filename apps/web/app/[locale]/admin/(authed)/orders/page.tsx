import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { OrderStatus } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"

import { OrdersSearch } from "@/components/admin/orders/orders-search"
import { OrdersStatusTabs } from "@/components/admin/orders/orders-status-tabs"
import { OrdersTable } from "@/components/admin/orders/orders-table"
import { listOrders, type OrderWithItems } from "@/lib/repos/orders.repo"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

const PAGE_SIZE = 20
/**
 * The repo exposes only exact-phone filtering + offset pagination (no order-number
 * prefix search, no count). For v1 admin volume we fetch a bounded window for the
 * selected status and apply the free-text filter + pagination in memory.
 */
const FETCH_WINDOW = 500

/** All statuses surfaced by the tabs (PENDING_VERIFICATION hidden by default). */
const TAB_STATUSES = new Set<string>([
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUSED,
  OrderStatus.CANCELLED,
])

/** Default list excludes abandoned-at-OTP orders. */
const DEFAULT_STATUSES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUSED,
  OrderStatus.CANCELLED,
]

function matchesQuery(order: OrderWithItems, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    order.orderNumber.toLowerCase().startsWith(needle) ||
    order.orderNumber.toLowerCase().includes(needle) ||
    order.phone.includes(q) ||
    order.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
  )
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/orders">) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const sp = await searchParams
  const t = await getTranslations("admin.orders")

  const statusParam = typeof sp.status === "string" ? sp.status : ""
  const q = typeof sp.q === "string" ? sp.q.trim() : ""
  const showUnverified = sp.status === OrderStatus.PENDING_VERIFICATION
  const pageRaw = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  let statusFilter: OrderStatus | OrderStatus[]
  if (showUnverified) {
    statusFilter = OrderStatus.PENDING_VERIFICATION
  } else if (TAB_STATUSES.has(statusParam)) {
    statusFilter = statusParam as OrderStatus
  } else {
    statusFilter = DEFAULT_STATUSES
  }

  const fetched = await listOrders({
    status: statusFilter,
    take: FETCH_WINDOW,
  })

  const filtered = q ? fetched.filter((o) => matchesQuery(o, q)) : fetched
  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount)
  const start = (clampedPage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)

  const activeTab = showUnverified
    ? "all"
    : TAB_STATUSES.has(statusParam)
      ? statusParam
      : "all"

  const buildPageHref = (target: number) => {
    const usp = new URLSearchParams()
    if (statusParam) usp.set("status", statusParam)
    if (q) usp.set("q", q)
    if (target > 1) usp.set("page", String(target))
    const query = usp.toString()
    return query
      ? `/${locale}/admin/orders?${query}`
      : `/${locale}/admin/orders`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl">{t("list.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("list.count", { count: total })}
            {showUnverified ? t("list.unverified_suffix") : ""}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/orders?status=${OrderStatus.PENDING_VERIFICATION}`}
          className="text-muted-foreground text-xs underline-offset-4 hover:underline"
        >
          {showUnverified ? t("list.back_to_all") : t("list.view_unverified")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <OrdersStatusTabs status={activeTab} />
        <OrdersSearch q={q} />
      </div>

      <OrdersTable orders={pageItems} locale={locale} />

      {pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {t("pagination.page_of", { page: clampedPage, total: pageCount })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={clampedPage <= 1}
            >
              <Link href={buildPageHref(clampedPage - 1)}>
                {t("pagination.previous")}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={clampedPage >= pageCount}
            >
              <Link href={buildPageHref(clampedPage + 1)}>
                {t("pagination.next")}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
