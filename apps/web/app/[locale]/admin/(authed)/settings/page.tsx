import { getTranslations } from "next-intl/server"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { DEFAULT_AI_MODEL_ID } from "@/components/admin/ai/types"
import { AiModelForm } from "@/components/admin/settings/ai-model-form"
import { AntiAbuseForm } from "@/components/admin/settings/anti-abuse-form"
import { ContactForm } from "@/components/admin/settings/contact-form"
import { GridForm } from "@/components/admin/settings/grid-form"
import { HeroForm } from "@/components/admin/settings/hero-form"
import { ShippingForm } from "@/components/admin/settings/shipping-form"
import { SizeChartEditor } from "@/components/admin/settings/size-chart-editor"
import { DEFAULT_GRID, parseGridConfig } from "@/lib/grid-config"
import { parseHeroConfig } from "@/lib/hero-config"
import { listPopularProducts } from "@/lib/repos/products.repo"
import {
  getAllSettings,
  type KnownSettings,
} from "@/lib/repos/settings.repo"

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

  const flatFils = read(all, "shipping.flat_fils", 2500)
  const freeThresholdFils = read(all, "shipping.free_threshold_fils", 60000)
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
  const sizeChart = read(all, "size_chart.cm", { unit: "cm", rows: [] })
  const maxItems = read(all, "order.max_items", 5)
  const maxQtyPerVariant = read(all, "order.max_qty_per_variant", 2)
  const aiModel = read(all, "ai.model", DEFAULT_AI_MODEL_ID)
  const hero = parseHeroConfig(all["home.hero"])
  const grid = parseGridConfig(read(all, "home.grid", DEFAULT_GRID))
  const productLinks = await listPopularProducts(10)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{t("page.heading")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("page.description")}
        </p>
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="max-w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [scrollbar-width:none]">
          <TabsTrigger value="hero">{t("tabs.hero")}</TabsTrigger>
          <TabsTrigger value="shipping">{t("tabs.shipping")}</TabsTrigger>
          <TabsTrigger value="contact">{t("tabs.contact")}</TabsTrigger>
          <TabsTrigger value="grid">{t("tabs.grid")}</TabsTrigger>
          <TabsTrigger value="size-chart">{t("tabs.size_chart")}</TabsTrigger>
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

        <TabsContent value="shipping" className="pt-4">
          <SettingsCard
            title={t("shipping.card_title")}
            description={t("shipping.card_description")}
          >
            <ShippingForm
              flatFils={flatFils}
              freeThresholdFils={freeThresholdFils}
            />
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

        <TabsContent value="size-chart" className="pt-4">
          <SettingsCard
            title={t("size_chart.card_title")}
            description={t("size_chart.card_description")}
          >
            <SizeChartEditor chart={sizeChart} />
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
      </Tabs>
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
