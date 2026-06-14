import { getTranslations } from "next-intl/server"

import {
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { SettingsTabs } from "@/components/admin/settings/settings-tabs"

import { DEFAULT_AI_MODEL_ID } from "@/components/admin/ai/types"
import { AiModelForm } from "@/components/admin/settings/ai-model-form"
import { AntiAbuseForm } from "@/components/admin/settings/anti-abuse-form"
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
  getAllSettings,
  type KnownSettings,
} from "@/lib/repos/settings.repo"

type ShopByTranslator = Awaited<ReturnType<typeof getTranslations>>

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

      <SettingsTabs defaultValue="hero">
        <TabsList className="max-w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [scrollbar-width:none]">
          <TabsTrigger value="hero">{t("tabs.hero")}</TabsTrigger>
          <TabsTrigger value="home-sections">
            {t("tabs.home_sections")}
          </TabsTrigger>
          <TabsTrigger value="markets">{t("tabs.markets")}</TabsTrigger>
          <TabsTrigger value="currency">{t("tabs.currency")}</TabsTrigger>
          <TabsTrigger value="contact">{t("tabs.contact")}</TabsTrigger>
          <TabsTrigger value="company">{t("tabs.company")}</TabsTrigger>
          <TabsTrigger value="grid">{t("tabs.grid")}</TabsTrigger>
          <TabsTrigger value="shop-by">{t("tabs.shop_by")}</TabsTrigger>
          <TabsTrigger value="size-chart">{t("tabs.size_chart")}</TabsTrigger>
          <TabsTrigger value="shipping-return">
            {t("tabs.shipping_return")}
          </TabsTrigger>
          <TabsTrigger value="returns">{t("tabs.returns")}</TabsTrigger>
          <TabsTrigger value="limits">{t("tabs.limits")}</TabsTrigger>
          <TabsTrigger value="ai">{t("tabs.ai")}</TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="pt-4">
          <SettingsCard
            title={t("hero.card_title")}
            description={t("hero.card_description")}
          >
            <HeroForm initial={hero} productLinks={productLinks} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="home-sections" className="pt-4">
          <SettingsCard
            title={t("home_sections.card_title")}
            description={t("home_sections.card_description")}
          >
            <HomeSectionsForm initial={homeLayout} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="markets" className="pt-4 space-y-4">
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

        <TabsContent value="currency" className="pt-4">
          <SettingsCard
            title={t("currency.card_title")}
            description={t("currency.card_description")}
          >
            <CurrencyForm initial={currencyConfig} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="contact" className="pt-4">
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

        <TabsContent value="company" className="pt-4">
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

        <TabsContent value="grid" className="pt-4">
          <SettingsCard
            title={t("grid.card_title")}
            description={t("grid.card_description")}
          >
            <GridForm initial={grid} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="shop-by" className="pt-4">
          <SettingsCard
            title={t("shop_by.card_title")}
            description={t("shop_by.card_description")}
          >
            <ShopByForm initial={shopBy} presets={shopByPresets} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="size-chart" className="pt-4">
          <SettingsCard
            title={t("size_chart.card_title")}
            description={t("size_chart.card_description")}
          >
            <SizeChartEditor chart={sizeChart} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="shipping-return" className="pt-4">
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

        <TabsContent value="returns" className="pt-4">
          <SettingsCard
            title={t("returns.card_title")}
            description={t("returns.card_description")}
          >
            <ReturnsForm windowDays={returnsWindowDays} />
          </SettingsCard>
        </TabsContent>

        <TabsContent value="limits" className="pt-4">
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

        <TabsContent value="ai" className="pt-4">
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
