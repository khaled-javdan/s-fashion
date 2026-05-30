import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { AnalyticsRangeControls } from "@/components/admin/analytics/analytics-range-controls"
import { SalesAreaChart } from "@/components/admin/analytics/sales-area-chart"
import { TopProductsChart } from "@/components/admin/analytics/top-products-chart"
import { auth } from "@/lib/auth"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"
import { filsToAed, formatAed } from "@/lib/money"
import {
  getDashboardOrderStats,
  getSalesAnalytics,
} from "@/lib/repos/orders.repo"
import { countLowStockVariants } from "@/lib/repos/products.repo"

const PRESETS = [7, 30, 90] as const

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const sp = await searchParams

  // Resolve the analytics window: explicit from/to wins, else a preset (default 30).
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const isCustom = !!(sp.from && dateRe.test(sp.from) && sp.to && dateRe.test(sp.to))
  const presetDays = PRESETS.includes(Number(sp.range) as (typeof PRESETS)[number])
    ? Number(sp.range)
    : 30
  const range = isCustom ? { from: sp.from, to: sp.to } : { days: presetDays }

  const session = await auth()
  const name = session?.user?.name ?? "Admin"
  const t = await getTranslations("admin.dashboard")
  const tA = await getTranslations("admin.analytics")

  const [orderStats, lowStock, analytics] = await Promise.all([
    getDashboardOrderStats(),
    countLowStockVariants(),
    getSalesAnalytics(range),
  ])

  const cards = [
    {
      key: "orders_today" as const,
      value: String(orderStats.ordersToday),
      href: `/${locale}/admin/orders`,
    },
    {
      key: "pending_orders" as const,
      value: String(orderStats.pendingOrders),
      href: `/${locale}/admin/orders?status=NEW`,
    },
    {
      key: "low_stock" as const,
      value: String(lowStock),
      href: `/${locale}/admin/products`,
    },
  ]

  const kpis = [
    { label: tA("total_sales"), value: formatAed(analytics.totalSalesFils, locale) },
    { label: tA("net_revenue"), value: formatAed(analytics.netRevenueFils, locale) },
    { label: tA("collected"), value: formatAed(analytics.collectedFils, locale) },
    { label: tA("orders"), value: String(analytics.orders) },
    { label: tA("avg_order_value"), value: formatAed(analytics.aovFils, locale) },
    { label: tA("units_sold"), value: String(analytics.units) },
  ]

  const salesData = analytics.daily.map((d) => ({
    date: d.date,
    sales: filsToAed(d.salesFils),
    collected: filsToAed(d.collectedFils),
  }))
  const topData = analytics.topProducts.map((p) => ({
    name: locale === "ar" ? p.nameAr : p.nameEn,
    revenue: filsToAed(p.revenueFils),
    units: p.units,
  }))

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-3xl">{t("welcome", { name })}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="bg-card text-card-foreground hover:border-foreground/30 focus-visible:ring-ring rounded-md border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
              {t(card.key)}
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">
              {card.value}
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl">{tA("heading")}</h2>
          <AnalyticsRangeControls
            presets={PRESETS.map((days) => ({
              days,
              label: tA("n_days", { days }),
            }))}
            activeDays={isCustom ? null : presetDays}
            from={analytics.from}
            to={analytics.to}
            labels={{ apply: tA("apply"), from: tA("from"), to: tA("to") }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-card text-card-foreground rounded-md border p-5"
            >
              <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
                {kpi.label}
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="bg-card text-card-foreground rounded-md border p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-medium">{tA("sales_over_time")}</h3>
            <SalesAreaChart
              data={salesData}
              locale={locale}
              labels={{ sales: tA("total_sales"), collected: tA("collected") }}
            />
          </div>
          <div className="bg-card text-card-foreground rounded-md border p-5">
            <h3 className="mb-4 text-sm font-medium">{tA("top_products")}</h3>
            <TopProductsChart
              data={topData}
              locale={locale}
              labels={{
                revenue: tA("revenue"),
                units: tA("units_sold"),
                empty: tA("no_sales"),
              }}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
