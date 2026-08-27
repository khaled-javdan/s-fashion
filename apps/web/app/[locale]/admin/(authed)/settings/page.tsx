import { getTranslations } from "next-intl/server"
import { Fragment } from "react"

import {
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { SettingsTabs } from "@/components/admin/settings/settings-tabs"

import { DEFAULT_AI_MODEL_ID } from "@/components/admin/ai/types"
import { AiModelForm } from "@/components/admin/settings/ai-model-form"
import { AntiAbuseForm } from "@/components/admin/settings/anti-abuse-form"
import { MarketingForm } from "@/components/admin/settings/marketing-form"
import { PaymentsForm } from "@/components/admin/settings/payments-form"
import { RecoveryForm } from "@/components/admin/settings/recovery-form"
import { CompanyForm } from "@/components/admin/settings/company-form"
import { ContactForm } from "@/components/admin/settings/contact-form"
import { GridForm } from "@/components/admin/settings/grid-form"
import { HeroForm } from "@/components/admin/settings/hero-form"
import { HomeSectionsForm } from "@/components/admin/settings/home-sections-form"
import { CurrencyForm } from "@/components/admin/settings/currency-form"
import { MarketModeForm } from "@/components/admin/settings/market-mode-form"
import { MarketsForm } from "@/components/admin/settings/markets-form"
import { ReturnsForm } from "@/components/admin/settings/returns-form"
import { ShippingReturnForm } from "@/components/admin/settings/shipping-return-form"
import { ShopByForm } from "@/components/admin/settings/shop-by-form"
import { SizeChartEditor } from "@/components/admin/settings/size-chart-editor"
import { parseCurrencyConfig } from "@/lib/currency-config"
import { DEFAULT_GRID, parseGridConfig } from "@/lib/grid-config"
import { parseHeroConfig } from "@/lib/hero-config"
import { parseHomeLayout } from "@/lib/home-sections-config"
import { DEFAULT_MAX_QTY_PER_VARIANT } from "@/lib/order-limits"
import { parseShippingConfig } from "@/lib/shipping-config"
import {
  parseShopByConfig,
  type ShopByPreset,
} from "@/lib/shop-by-config"
import {
  getCatalogFacets,
  listPopularProducts,
  type CatalogFacets,
} from "@/lib/repos/products.repo"
import {
  DEFAULT_ABANDONED_EMAIL,
  DEFAULT_EXIT_OFFER,
  getAllSettings,
  type KnownSettings,
} from "@/lib/repos/settings.repo"

type ShopByTranslator = Awaited<ReturnType<typeof getTranslations>>

/**
 * Sidebar nav, grouped. Fifteen settings panels overflowed the old top tab
 * strip, so they live in a vertical inner sidebar instead — grouped by what
 * they affect so the column stays scannable. `tab` is the `?tab=` value and the
 * `tabs.*` translation key (dashes → underscores).
 */
const NAV_GROUPS = [
  { group: "storefront", tabs: ["hero", "home-sections", "grid", "shop-by"] },
  { group: "markets", tabs: ["markets", "currency", "payments"] },
  {
    group: "policies",
    tabs: ["size-chart", "shipping-return", "returns", "limits"],
  },
  {
    group: "business",
    tabs: ["contact", "company", "marketing", "recovery", "ai"],
  },
] as const

/**
 * Build the shop-by target presets with both English and Arabic labels: six
 * fixed catalogue shortcuts plus a handful of colours/sizes from the live
 * facets. `tEn`/`tAr` are translators bound to each locale so each preset
 * carries both labels.
 */
function buildShopByPresets(
  tEn: ShopByTranslator,
  tAr: ShopByTranslator,
  facets: CatalogFacets,
): ShopByPreset[] {
  const fixed = [
    { value: "/products", key: "preset_all" },
    { value: "/products?sort=newest", key: "preset_new_in" },
    { value: "/products?sort=best_selling", key: "preset_best_selling" },
    { value: "/products?on_sale=1", key: "preset_on_sale" },
    { value: "/products?in_stock=1", key: "preset_in_stock" },
    { value: "/products?sort=price_asc", key: "preset_price_low" },
  ] as const
  const base: ShopByPreset[] = fixed.map((f) => ({
    value: f.value,
    labelEn: tEn(f.key),
    labelAr: tAr(f.key),
  }))
  const colors: ShopByPreset[] = facets.colors
    .filter((c) => c.nameEn)
    .slice(0, 6)
    .map((c) => ({
      value: `/products?color=${(c.nameEn ?? "").toLowerCase()}`,
      labelEn: tEn("preset_color", { name: c.nameEn ?? "" }),
      labelAr: tAr("preset_color", { name: c.nameAr ?? c.nameEn ?? "" }),
    }))
  const sizes: ShopByPreset[] = facets.sizes.map((s) => ({
    value: `/products?size=${s}`,
    labelEn: tEn("preset_size", { size: s }),
    labelAr: tAr("preset_size", { size: s }),
  }))
  return [...base, ...colors, ...sizes]
}

/** Read a setting from the map with a typed fallback. */
function read<K extends keyof KnownSettings>(
  all: Record<string, unknown>,
  key: K,
  fallback: KnownSettings[K],
): KnownSettings[K] {
  const value = all[key]
  return value === undefined || value === null
    ? fallback
    : (value as KnownSettings[K])
}

export default async function AdminSettingsPage() {
  const t = await getTranslations("admin.settings")
  const all = await getAllSettings()

  const marketMode = (all["market.mode"] as "uae" | "gcc" | undefined) ?? "uae"
  const shippingConfig = parseShippingConfig(all["shipping.countries"])
  const currencyConfig = parseCurrencyConfig(all["currency.config"])
  const whatsappNumber = read(all, "contact.whatsapp_number", "+971501234567")
  const businessHoursAr = read(
    all,
    "contact.business_hours_ar",
    "السبت – الخميس، 10ص – 10م",
  )
  const businessHoursEn = read(
    all,
    "contact.business_hours_en",
    "Sat–Thu, 10am – 10pm",
  )
  const contactEmail = read(all, "contact.email", "")
  const contactSocial = read(all, "contact.social", {
    instagram: "",
    tiktok: "",
    snapchat: "",
  })
  const returnsWindowDays = read(all, "returns.window_days", 14)
  const companyLegalName = read(all, "company.legal_name", "")
  const companyTradeLicense = read(all, "company.trade_license", "")
  const companyVatTrn = read(all, "company.vat_trn", "")
  const sizeChart = read(all, "size_chart.cm", {
    unit: "in" as const,
    rows: [],
  })
  const shippingReturn = read(all, "product.shipping_return", {
    contentAr: "",
    contentEn: "",
  })
  const maxItems = read(all, "order.max_items", 5)
  const maxQtyPerVariant = read(
    all,
    "order.max_qty_per_variant",
    DEFAULT_MAX_QTY_PER_VARIANT,
  )
  const aiModel = read(all, "ai.model", DEFAULT_AI_MODEL_ID)
  const whatsappEnabled = (all["marketing.whatsapp_enabled"] as boolean | undefined) ?? true
  const stripeEnabled = read(all, "payments.stripe_enabled", false)
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY)
  const welcomeDiscountPercent = read(all, "marketing.welcome_discount_percent", 10)
  const exitOffer = read(all, "checkout.exit_offer", DEFAULT_EXIT_OFFER)
  const abandonedEmail = read(
    all,
    "checkout.abandoned_email",
    DEFAULT_ABANDONED_EMAIL,
  )
  const hero = parseHeroConfig(all["home.hero"])
  const grid = parseGridConfig(read(all, "home.grid", DEFAULT_GRID))
  const shopBy = parseShopByConfig(all["home.shop_by"])
  const homeLayout = parseHomeLayout(all["home.sections"])
  const [productLinks, productFacets, tEnShopBy, tArShopBy] = await Promise.all([
    listPopularProducts(10),
    getCatalogFacets(),
    getTranslations({ locale: "en", namespace: "admin.settings.shop_by" }),
    getTranslations({ locale: "ar", namespace: "admin.settings.shop_by" }),
  ])
  // Build the shop-by target presets with BOTH locale labels here on the server
  // (a client component only has the active locale), so picking a preset can
  // pre-fill a tile's empty English/Arabic labels.
  const shopByPresets = buildShopByPresets(tEnShopBy, tArShopBy, productFacets)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{t("page.heading")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("page.description")}
        </p>
      </div>

      <SettingsTabs
        defaultValue="hero"
        orientation="vertical"
        className="gap-4 max-lg:flex-col lg:gap-6"
      >
        {/* Below `lg` the sidebar can't earn its width, so it flattens back
            into the horizontally scrolling strip phones can handle. On `lg`,
            `top`/`max-h` clear the fixed h-14 admin topbar and keep a tall nav
            scrollable rather than stranding its last items off-screen. */}
        <TabsList className="justify-start rounded-md max-lg:max-w-full max-lg:flex-row! max-lg:overflow-x-auto max-lg:[&::-webkit-scrollbar]:hidden max-lg:[&>*]:w-fit! max-lg:[&>*]:shrink-0 max-lg:[scrollbar-width:none] lg:sticky lg:top-[4.5rem] lg:h-fit lg:max-h-[calc(100vh-6rem)] lg:w-56 lg:shrink-0 lg:items-stretch lg:self-start lg:overflow-y-auto">
          {NAV_GROUPS.map(({ group, tabs }, index) => (
            <Fragment key={group}>
              <p
                className={cn(
                  "text-muted-foreground px-4 pb-1 text-[0.68rem] font-semibold tracking-wider uppercase max-lg:hidden",
                  index === 0 ? "pt-1" : "pt-3",
                )}
              >
                {t(`tab_groups.${group}`)}
              </p>
              {tabs.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {t(`tabs.${tab.replace(/-/g, "_")}`)}
                </TabsTrigger>
              ))}
            </Fragment>
          ))}
        </TabsList>

        <TabsContent value="hero">
          <SettingsCard
            title={t("hero.card_title")}
            description={t("hero.card_description")}
          >
            <HeroForm initial={hero} productLinks={productLinks} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="home-sections">
          <SettingsCard
            title={t("home_sections.card_title")}
            description={t("home_sections.card_description")}
          >
            <HomeSectionsForm initial={homeLayout} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="markets" className="space-y-4">
          <SettingsCard
            title={t("market_mode.card_title")}
            description={t("market_mode.card_description")}
          >
            <MarketModeForm initial={marketMode} />
          </SettingsCard>
          <SettingsCard
            title={t("markets.card_title")}
            description={t("markets.card_description")}
          >
            <MarketsForm initial={shippingConfig} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="currency">
          <SettingsCard
            title={t("currency.card_title")}
            description={t("currency.card_description")}
          >
            <CurrencyForm initial={currencyConfig} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="contact">
          <SettingsCard
            title={t("contact.card_title")}
            description={t("contact.card_description")}
          >
            <ContactForm
              whatsappNumber={whatsappNumber}
              businessHoursAr={businessHoursAr}
              businessHoursEn={businessHoursEn}
              email={contactEmail}
              social={contactSocial}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="company">
          <SettingsCard
            title={t("company.card_title")}
            description={t("company.card_description")}
          >
            <CompanyForm
              legalName={companyLegalName}
              tradeLicense={companyTradeLicense}
              vatTrn={companyVatTrn}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="grid">
          <SettingsCard
            title={t("grid.card_title")}
            description={t("grid.card_description")}
          >
            <GridForm initial={grid} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="shop-by">
          <SettingsCard
            title={t("shop_by.card_title")}
            description={t("shop_by.card_description")}
          >
            <ShopByForm initial={shopBy} presets={shopByPresets} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="size-chart">
          <SettingsCard
            title={t("size_chart.card_title")}
            description={t("size_chart.card_description")}
          >
            <SizeChartEditor chart={sizeChart} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="shipping-return">
          <SettingsCard
            title={t("shipping_return.card_title")}
            description={t("shipping_return.card_description")}
          >
            <ShippingReturnForm
              contentAr={shippingReturn.contentAr}
              contentEn={shippingReturn.contentEn}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="returns">
          <SettingsCard
            title={t("returns.card_title")}
            description={t("returns.card_description")}
          >
            <ReturnsForm windowDays={returnsWindowDays} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="limits">
          <SettingsCard
            title={t("limits.card_title")}
            description={t("limits.card_description")}
          >
            <AntiAbuseForm
              maxItems={maxItems}
              maxQtyPerVariant={maxQtyPerVariant}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="payments">
          <SettingsCard
            title={t("payments.card_title")}
            description={t("payments.card_description")}
          >
            <PaymentsForm
              stripeEnabled={stripeEnabled}
              stripeConfigured={stripeConfigured}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="marketing">
          <SettingsCard
            title={t("marketing.card_title")}
            description={t("marketing.card_description")}
          >
            <MarketingForm
              whatsappEnabled={whatsappEnabled}
              welcomeDiscountPercent={welcomeDiscountPercent}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="recovery">
          <SettingsCard
            title={t("recovery.card_title")}
            description={t("recovery.card_description")}
          >
            <RecoveryForm
              exitOffer={exitOffer}
              abandonedEmail={abandonedEmail}
            />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="ai">
          <SettingsCard
            title={t("ai_model.card_title")}
            description={t("ai_model.card_description")}
          >
            <AiModelForm current={aiModel} />
          </SettingsCard>
        </TabsContent>
      </SettingsTabs>
    </div>
  )
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-card text-card-foreground space-y-4 rounded-md border p-6">
      <div>
        <h2 className="font-heading text-xl">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {children}
    </section>
  )
}
