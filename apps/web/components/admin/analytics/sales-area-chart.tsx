"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Point = { date: string; sales: number; collected: number }

type Props = {
  data: Point[]
  locale: "ar" | "en"
  /** Tooltip / legend labels (localized by the server). */
  labels: { sales: string; collected: string }
}

/**
 * Daily area chart (AED), last N days: gross sales (placed) vs collected
 * (delivered) — so the gap shows what's ordered but not yet collected.
 * Themed via --chart-1 (sales) and --chart-2 (collected).
 */
export function SalesAreaChart({ data, locale, labels }: Props) {
  const isRtl = locale === "ar"
  const intl = isRtl ? "ar-AE" : "en-AE"
  const money = new Intl.NumberFormat(intl, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  })
  const dayMonth = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
  })
  const fmtDate = (iso: string) => dayMonth.format(new Date(`${iso}T00:00:00`))

  return (
    <div className="h-[260px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="date"
            reversed={isRtl}
            tickFormatter={fmtDate}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            orientation={isRtl ? "right" : "left"}
            width={44}
            tickFormatter={(v: number) => money.format(v)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            labelFormatter={(iso) => fmtDate(String(iso))}
            formatter={(value, key) => {
              const v = Number(value)
              return [
                money.format(v),
                key === "collected" ? labels.collected : labels.sales,
              ]
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
          <Legend
            formatter={(key) =>
              key === "collected" ? labels.collected : labels.sales
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#salesFill)"
          />
          <Area
            type="monotone"
            dataKey="collected"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#collectedFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
