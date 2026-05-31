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
import type { SizeChartRow } from "./size-chart-modal"

type Props = {
  locale: Locale
  description: string | null
  additionalInfo: string | null
  shippingReturn: string | null
  sizeChartRows: SizeChartRow[]
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
  sizeChartRows,
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
    sizeChartRows.length > 0
      ? {
          value: "size-chart",
          label: t("tabs.size_chart"),
          content: <SizeChartTable locale={locale} rows={sizeChartRows} />,
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

async function SizeChartTable({
  locale,
  rows,
}: {
  locale: Locale
  rows: SizeChartRow[]
}) {
  const t = await getTranslations("product")
  const cell = (value: number | null) => (value == null ? "—" : value)
  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <div className="space-y-3" dir={dir}>
      <p className="text-muted-foreground text-xs">{t("size_chart_unit")}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-border border-b text-start">
              <th className="py-2 ps-0 pe-3 text-start font-medium">
                {t("size_chart_size")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_bust")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_waist")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_hips")}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t("size_chart_length")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.size} className="border-border/60 border-b">
                <td className="py-2 ps-0 pe-3 font-medium">{row.size}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.bust)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.waist)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.hips)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(row.length)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
