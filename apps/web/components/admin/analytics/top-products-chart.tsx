"use client"

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Row = { name: string; revenue: number; units: number }

type Props = {
  data: Row[]
  locale: "ar" | "en"
  labels: { revenue: string; units: string; empty: string }
}

const BARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

/** Top products by revenue (AED) as a horizontal bar chart. */
export function TopProductsChart({ data, locale, labels }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
        {labels.empty}
      </div>
    )
  }

  const isRtl = locale === "ar"
  const intl = isRtl ? "ar-AE" : "en-AE"
  const money = new Intl.NumberFormat(intl, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  })

  return (
    <div className="h-[260px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
        >
          <XAxis type="number" hide reversed={isRtl} />
          <YAxis
            type="category"
            dataKey="name"
            orientation={isRtl ? "right" : "left"}
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{
              fontSize: 11,
              fill: "var(--foreground)",
              textAnchor: isRtl ? "start" : "end",
            }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value, key) => {
              const v = Number(value)
              return key === "revenue"
                ? [money.format(v), labels.revenue]
                : [v, labels.units]
            }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: 12,
              direction: isRtl ? "rtl" : "ltr",
              textAlign: isRtl ? "right" : "left",
            }}
          />
          <Bar dataKey="revenue" radius={4} barSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={BARS[i % BARS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
