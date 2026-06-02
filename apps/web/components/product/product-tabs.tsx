import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import type { Locale } from "@/lib/locale"

import { RichText } from "./rich-text"
import {
  SizeChartView,
  type SizeChartRow,
  type SizeChartUnit,
} from "./size-chart-view"

type Props = {
  locale: Locale
  description: string | null
  additionalInfo: string | null
  shippingReturn: string | null
  sizeChart: { unit: SizeChartUnit; rows: SizeChartRow[] } | null
  /** Rendered "Reviews" panel — always shown last so customers can review. */
  reviews?: ReactNode
}

/**
 * Underlined product tabs (Description / Additional info / Shipping & Return /
 * Size Chart). Tabs whose content is empty are hidden — the storefront never
 * shows a blank panel. Falls back to the description tab when only one tab is
 * rendered.
 */
export async function ProductTabs({
  locale,
  description,
  additionalInfo,
  shippingReturn,
  sizeChart,
  reviews,
}: Props) {
  const t = await getTranslations("product")
  const dir = locale === "ar" ? "rtl" : "ltr"

  const panels = [
    description
      ? {
          value: "description",
          label: t("tabs.description"),
          content: <RichText html={description} dir={dir} />,
        }
      : null,
    additionalInfo
      ? {
          value: "additional",
          label: t("tabs.additional_info"),
          content: <RichText html={additionalInfo} dir={dir} />,
        }
      : null,
    shippingReturn
      ? {
          value: "shipping",
          label: t("tabs.shipping_return"),
          content: <RichText html={shippingReturn} dir={dir} />,
        }
      : null,
    sizeChart && sizeChart.rows.length > 0
      ? {
          value: "size-chart",
          label: t("tabs.size_chart"),
          content: (
            <div dir={dir}>
              <SizeChartView
                unit={sizeChart.unit}
                rows={sizeChart.rows}
                locale={locale}
              />
            </div>
          ),
        }
      : null,
    reviews
      ? {
          value: "reviews",
          label: t("tabs.reviews"),
          content: reviews,
        }
      : null,
  ].filter((panel): panel is NonNullable<typeof panel> => panel !== null)

  if (panels.length === 0) return null

  // `dir` flows down to the strip, so it follows the page direction without a
  // manual reverse: the direction-aware `justify-start` resolves to the right
  // edge in Arabic (RTL), placing the first panel (Description) on the RIGHT,
  // and to the left edge in English. DOM order (and keyboard arrow order) is
  // unchanged, so the active tab stays first for assistive tech.
  return (
    <Tabs dir={dir} defaultValue={panels[0]!.value} className="w-full">
      <TabsList
        variant="line"
        dir={dir}
        className="border-border w-full justify-start gap-6 overflow-x-auto border-b sm:gap-10 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [scrollbar-width:none]"
      >
        {panels.map((panel) => (
          <TabsTrigger key={panel.value} value={panel.value}>
            {panel.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel) => (
        <TabsContent key={panel.value} value={panel.value} className="pt-6">
          {panel.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

