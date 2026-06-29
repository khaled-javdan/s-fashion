"use client"

import type { MetaCampaign } from "@/lib/meta-ads"

type Props = {
  campaigns: MetaCampaign[]
  currency: string
  locale: "ar" | "en"
  labels: {
    name: string
    spend: string
    impressions: string
    clicks: string
    ctr: string
    purchases: string
    roas: string
    empty: string
  }
}

export function MetaCampaignsTable({ campaigns, currency, locale, labels }: Props) {
  const intl = locale === "ar" ? "ar-AE" : "en-AE"
  const compact = new Intl.NumberFormat(intl, { notation: "compact" })
  const money = new Intl.NumberFormat(intl, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  })

  if (campaigns.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">{labels.empty}</p>
    )
  }

  const cols: { key: keyof MetaCampaign; label: string; align: "left" | "right" }[] = [
    { key: "name", label: labels.name, align: "left" },
    { key: "spend", label: labels.spend, align: "right" },
    { key: "impressions", label: labels.impressions, align: "right" },
    { key: "clicks", label: labels.clicks, align: "right" },
    { key: "ctr", label: labels.ctr, align: "right" },
    { key: "purchases", label: labels.purchases, align: "right" },
    { key: "roas", label: labels.roas, align: "right" },
  ]

  const fmt = (key: keyof MetaCampaign, value: number): string => {
    if (key === "spend" || key === "cpc") return money.format(value)
    if (key === "ctr") return `${value.toFixed(2)}%`
    if (key === "roas") return `${value.toFixed(2)}×`
    if (key === "impressions" || key === "clicks" || key === "purchases") return compact.format(value)
    return String(value)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {cols.map((col) => (
              <th
                key={col.key}
                className={[
                  "text-muted-foreground pb-2 text-[10px] font-semibold uppercase tracking-widest",
                  col.align === "right" ? "text-right" : "text-left",
                  col.key === "name" ? "min-w-[180px]" : "whitespace-nowrap px-3",
                ].join(" ")}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40 border-b last:border-0">
              {cols.map((col) => (
                <td
                  key={col.key}
                  className={[
                    "py-3 tabular-nums",
                    col.align === "right" ? "text-right" : "text-left",
                    col.key !== "name" ? "px-3" : "",
                    col.key === "name" ? "font-medium" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {col.key === "name"
                    ? c.name
                    : fmt(col.key, c[col.key] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
