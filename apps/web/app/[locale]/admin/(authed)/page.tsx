import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { AnalyticsRangeControls } from "@/components/admin/analytics/analytics-range-controls"
import { MetaCampaignsTable } from "@/components/admin/analytics/meta-campaigns-table"
import { ProductPerformanceTable } from "@/components/admin/analytics/product-performance-table"
import { ZeroSalesProducts } from "@/components/admin/analytics/zero-sales-products"
import { SalesAreaChart } from "@/components/admin/analytics/sales-area-chart"
import { TopProductsChart } from "@/components/admin/analytics/top-products-chart"
import { TrafficAreaChart } from "@/components/admin/analytics/traffic-area-chart"
import { auth } from "@/lib/auth"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"
import { filsToAed, formatAed } from "@/lib/money"
import { getMetaAdsStats } from "@/lib/meta-ads"
import {
  getDashboardOrderStats,
  getProductPerformance,
  getSalesAnalytics,
} from "@/lib/repos/orders.repo"
import { countLowStockVariants } from "@/lib/repos/products.repo"
import { getTrafficStats } from "@/lib/traffic-analytics"

const PRESETS = [7, 30, 90] as const
const TRAFFIC_PRESETS = [1, 7, 30] as const
const ADS_PRESETS = [7, 30, 90] as const

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    tab?: string
    range?: string
    from?: string
    to?: string
    vrange?: string
    vfrom?: string
    vto?: string
    mrange?: string
    mfrom?: string
    mto?: string
    prange?: string
    pfrom?: string
    pto?: string
  }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const sp = await searchParams

  const activeTab =
    sp.tab === "visitors"
      ? "visitors"
      : sp.tab === "ads"
        ? "ads"
        : sp.tab === "products"
          ? "products"
          : "orders"

  const dateRe = /^\d{4}-\d{2}-\d{2}$/

  // Orders analytics window
  const isCustom = !!(sp.from && dateRe.test(sp.from) && sp.to && dateRe.test(sp.to))
  const presetDays = PRESETS.includes(Number(sp.range) as (typeof PRESETS)[number])
    ? Number(sp.range)
    : 30
  const range = isCustom ? { from: sp.from, to: sp.to } : { days: presetDays }

  // Traffic analytics window
  const isTrafficCustom = !!(
    sp.vfrom && dateRe.test(sp.vfrom) && sp.vto && dateRe.test(sp.vto)
  )
  const trafficPresetDays = TRAFFIC_PRESETS.includes(
    Number(sp.vrange) as (typeof TRAFFIC_PRESETS)[number]
  )
    ? Number(sp.vrange)
    : 7
  const trafficRange = isTrafficCustom
    ? { from: sp.vfrom!, to: sp.vto! }
    : { days: trafficPresetDays }

  // Meta Ads analytics window
  const isAdsCustom = !!(
    sp.mfrom && dateRe.test(sp.mfrom) && sp.mto && dateRe.test(sp.mto)
  )
  const adsPresetDays = ADS_PRESETS.includes(
    Number(sp.mrange) as (typeof ADS_PRESETS)[number]
  )
    ? Number(sp.mrange)
    : 30
  const adsRange = isAdsCustom
    ? { from: sp.mfrom!, to: sp.mto! }
    : { days: adsPresetDays }

  // Product-performance analytics window (own param keys so it doesn't collide
  // with the orders-tab range).
  const isProductsCustom = !!(
    sp.pfrom && dateRe.test(sp.pfrom) && sp.pto && dateRe.test(sp.pto)
  )
  const productsPresetDays = PRESETS.includes(
    Number(sp.prange) as (typeof PRESETS)[number]
  )
    ? Number(sp.prange)
    : 30
  const productsRange = isProductsCustom
    ? { from: sp.pfrom!, to: sp.pto! }
    : { days: productsPresetDays }

  const session = await auth()
  const name = session?.user?.name ?? "Admin"
  const t = await getTranslations("admin.dashboard")
  const tA = await getTranslations("admin.analytics")
  const tT = await getTranslations("admin.traffic")
  const tM = await getTranslations("admin.ads")

  // Always fetch summary cards; fetch analytics only for the active tab
  const [orderStats, lowStock] = await Promise.all([
    getDashboardOrderStats(),
    countLowStockVariants(),
  ])

  const analytics = activeTab === "orders" ? await getSalesAnalytics(range) : null
  const trafficProvider = process.env.TRAFFIC_ANALYTICS_PROVIDER === "ga4" ? "ga4" : "vercel"
  const traffic = activeTab === "visitors" ? await getTrafficStats(trafficRange) : null
  const metaAds = activeTab === "ads" ? await getMetaAdsStats(adsRange) : null
  const productPerf =
    activeTab === "products" ? await getProductPerformance(productsRange) : null

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

  const kpis = analytics
    ? [
        { label: tA("total_sales"), value: formatAed(analytics.totalSalesFils, locale) },
        { label: tA("net_revenue"), value: formatAed(analytics.netRevenueFils, locale) },
        { label: tA("collected"), value: formatAed(analytics.collectedFils, locale) },
        { label: tA("gross_profit"), value: formatAed(analytics.grossProfitFils, locale) },
        {
          label: tA("profit_margin"),
          value: `${
            analytics.netRevenueFils > 0
              ? Math.round((analytics.grossProfitFils / analytics.netRevenueFils) * 100)
              : 0
          }%`,
        },
        { label: tA("orders"), value: String(analytics.orders) },
        { label: tA("avg_order_value"), value: formatAed(analytics.aovFils, locale) },
        { label: tA("units_sold"), value: String(analytics.units) },
      ]
    : []

  const paymentBreakdown = analytics
    ? (() => {
        const { cod, card } = analytics.payment
        const total = cod.salesFils + card.salesFils
        const share = (fils: number) =>
          total > 0 ? Math.round((fils / total) * 100) : 0
        return [
          {
            key: "cod" as const,
            label: tA("payment_cod"),
            value: formatAed(cod.salesFils, locale),
            orders: tA("payment_orders", { count: cod.orders }),
            share: tA("payment_share", { percent: share(cod.salesFils) }),
          },
          {
            key: "card" as const,
            label: tA("payment_card"),
            value: formatAed(card.salesFils, locale),
            orders: tA("payment_orders", { count: card.orders }),
            share: tA("payment_share", { percent: share(card.salesFils) }),
          },
        ]
      })()
    : []

  const salesData = analytics
    ? analytics.daily.map((d) => ({
        date: d.date,
        sales: filsToAed(d.salesFils),
        collected: filsToAed(d.collectedFils),
      }))
    : []

  const topData = analytics
    ? analytics.topProducts.map((p) => ({
        name: locale === "ar" ? p.nameAr : p.nameEn,
        revenue: filsToAed(p.revenueFils),
        units: p.units,
        unitsLabel: tA("units_short", { count: p.units }),
      }))
    : []

  const adsKpis = metaAds
    ? (() => {
        const moneyFmt = new Intl.NumberFormat(
          locale === "ar" ? "ar-AE" : "en-AE",
          { style: "currency", currency: metaAds.currency, maximumFractionDigits: 2 }
        )
        const numFmt = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE")
        return [
          { label: tM("spend"), value: moneyFmt.format(metaAds.spend) },
          { label: tM("reach"), value: numFmt.format(metaAds.reach) },
          { label: tM("impressions"), value: numFmt.format(metaAds.impressions) },
          { label: tM("clicks"), value: numFmt.format(metaAds.clicks) },
          { label: tM("ctr"), value: `${metaAds.ctr.toFixed(2)}%` },
          { label: tM("cpc"), value: moneyFmt.format(metaAds.cpc) },
          { label: tM("purchases"), value: numFmt.format(metaAds.purchases) },
          { label: tM("roas"), value: `${metaAds.roas.toFixed(2)}×` },
        ]
      })()
    : []

  const tabs = [
    { key: "orders", label: t("tab_orders") },
    { key: "products", label: t("tab_products") },
    { key: "visitors", label: t("tab_visitors") },
    // Meta Ads tab hidden until META_ADS_ACCESS_TOKEN is configured.
    // { key: "ads", label: t("tab_ads") },
  ] as const

  const productKpis = productPerf
    ? [
        { label: tA("units_sold"), value: String(productPerf.totalUnits) },
        {
          label: tA("variants_sold"),
          value: String(productPerf.variantsSold),
        },
        {
          label: tA("revenue"),
          value: formatAed(productPerf.totalRevenueFils, locale),
        },
        {
          label: tA("gross_profit"),
          value: formatAed(productPerf.totalProfitFils, locale),
        },
      ]
    : []

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

      {/* Tab navigation */}
      <nav className="border-b" aria-label="Analytics tabs">
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <Link
                key={tab.key}
                href={`?tab=${tab.key}`}
                className={[
                  "relative px-4 pb-3 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground after:bg-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:content-['']"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Order analytics tab */}
      {activeTab === "orders" && analytics && (
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

          <div className="bg-card text-card-foreground rounded-md border p-5">
            <h3 className="mb-4 text-sm font-medium">
              {tA("payment_methods")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {paymentBreakdown.map((row) => (
                <div
                  key={row.key}
                  className="flex items-baseline justify-between gap-3 rounded-md border p-4"
                >
                  <div>
                    <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
                      {row.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums">
                      {row.value}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {row.orders}
                    </div>
                  </div>
                  <div className="text-muted-foreground shrink-0 text-sm font-medium tabular-nums">
                    {row.share}
                  </div>
                </div>
              ))}
            </div>
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
      )}

      {/* Product performance tab */}
      {activeTab === "products" && productPerf && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl">{tA("product_performance")}</h2>
            <AnalyticsRangeControls
              presets={PRESETS.map((days) => ({
                days,
                label: tA("n_days", { days }),
              }))}
              activeDays={isProductsCustom ? null : productsPresetDays}
              from={productPerf.from}
              to={productPerf.to}
              labels={{ apply: tA("apply"), from: tA("from"), to: tA("to") }}
              paramKeys={{ range: "prange", from: "pfrom", to: "pto" }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productKpis.map((kpi) => (
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

          <div className="bg-card text-card-foreground rounded-md border p-5">
            <h3 className="mb-4 text-sm font-medium">
              {tA("ranked_by_units")}
            </h3>
            <ProductPerformanceTable rows={productPerf.rows} locale={locale} />
          </div>

          <div className="bg-card text-card-foreground rounded-md border p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium">{tA("zero_sales")}</h3>
              {productPerf.zeroSalesCount > 0 ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {tA("zero_sales_count", {
                    count: productPerf.zeroSalesCount,
                  })}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mb-4 text-xs">
              {tA("zero_sales_hint")}
            </p>
            <ZeroSalesProducts
              products={productPerf.zeroSales}
              total={productPerf.zeroSalesCount}
              locale={locale}
            />
          </div>
        </section>
      )}

      {/* Visitor analytics tab */}
      {activeTab === "visitors" && traffic && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl">{tT("heading")}</h2>
            <AnalyticsRangeControls
              presets={TRAFFIC_PRESETS.map((days) => ({
                days,
                label: days === 1 ? tT("today") : tT("n_days", { days }),
              }))}
              activeDays={isTrafficCustom ? null : trafficPresetDays}
              from={traffic.from}
              to={traffic.to}
              labels={{ apply: tA("apply"), from: tA("from"), to: tA("to") }}
              paramKeys={{ range: "vrange", from: "vfrom", to: "vto" }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-card text-card-foreground rounded-md border p-5">
              <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
                {tT("page_views")}
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">
                {traffic.pageviews.toLocaleString(locale === "ar" ? "ar-AE" : "en-AE")}
              </div>
            </div>
            <div className="bg-card text-card-foreground rounded-md border p-5">
              <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
                {tT("visitors")}
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">
                {traffic.visitors.toLocaleString(locale === "ar" ? "ar-AE" : "en-AE")}
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-md border p-5">
            <h3 className="mb-4 text-sm font-medium">{tT("over_time")}</h3>
            <TrafficAreaChart
              data={traffic.data}
              locale={locale}
              granularity={traffic.granularity}
              labels={{ pageviews: tT("page_views"), visitors: tT("visitors") }}
            />
          </div>
        </section>
      )}

      {activeTab === "visitors" && !traffic && (
        <p className="text-muted-foreground text-sm">
          {trafficProvider === "ga4" ? (
            <>
              Visitor analytics (GA4) requires <code>GA4_PROPERTY_ID</code>,{" "}
              <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and{" "}
              <code>GOOGLE_REFRESH_TOKEN</code> to be configured (see{" "}
              <code>.env.example</code>).
            </>
          ) : (
            <>
              Visitor analytics (Vercel Web Analytics) requires{" "}
              <code>VERCEL_API_TOKEN</code> and <code>VERCEL_PROJECT_ID</code> to be
              configured, and Web Analytics enabled on the project (see{" "}
              <code>.env.example</code>). Set <code>TRAFFIC_ANALYTICS_PROVIDER=ga4</code>{" "}
              to use Google Analytics instead.
            </>
          )}
        </p>
      )}

      {/* Meta Ads analytics tab */}
      {activeTab === "ads" && metaAds && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl">{tM("heading")}</h2>
            <AnalyticsRangeControls
              presets={ADS_PRESETS.map((days) => ({
                days,
                label: tM("n_days", { days }),
              }))}
              activeDays={isAdsCustom ? null : adsPresetDays}
              from={metaAds.from}
              to={metaAds.to}
              labels={{ apply: tM("apply"), from: tM("from"), to: tM("to") }}
              paramKeys={{ range: "mrange", from: "mfrom", to: "mto" }}
            />
          </div>

          {/* Account-level KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {adsKpis.map((kpi) => (
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

          {/* Per-campaign breakdown */}
          <div className="bg-card text-card-foreground rounded-md border p-5">
            <h3 className="mb-4 text-sm font-medium">{tM("campaigns")}</h3>
            <MetaCampaignsTable
              campaigns={metaAds.campaigns}
              currency={metaAds.currency}
              locale={locale}
              labels={{
                name: tM("campaign_name"),
                spend: tM("spend"),
                impressions: tM("impressions"),
                clicks: tM("clicks"),
                ctr: tM("ctr"),
                purchases: tM("purchases"),
                roas: tM("roas"),
                empty: tM("no_data"),
              }}
            />
          </div>
        </section>
      )}

      {activeTab === "ads" && !metaAds && (
        <p className="text-muted-foreground text-sm">{tM("not_configured")}</p>
      )}
    </div>
  )
}
