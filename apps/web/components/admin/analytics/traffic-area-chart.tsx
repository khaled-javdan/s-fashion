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

type Point = { key: string; pageviews: number; visitors: number }

type Props = {
  data: Point[]
  locale: "ar" | "en"
  granularity: "1h" | "1d"
  labels: { pageviews: string; visitors: string }
}

export function TrafficAreaChart({ data, locale, granularity, labels }: Props) {
  const isRtl = locale === "ar"
  const intl = isRtl ? "ar-AE" : "en-AE"
  const compact = new Intl.NumberFormat(intl, { notation: "compact" })

  const fmtKey = (key: string) => {
    const date = new Date(key)
    if (granularity === "1h") {
      return new Intl.DateTimeFormat(intl, { hour: "numeric" }).format(date)
    }
    return new Intl.DateTimeFormat(intl, {
      day: "numeric",
      month: "short",
    }).format(date)
  }

  return (
    <div className="h-[260px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
              <stop
                offset="100%"
                stopColor="var(--chart-3)"
                stopOpacity={0.02}
              />
            </linearGradient>
            <linearGradient id="visFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.3} />
              <stop
                offset="100%"
                stopColor="var(--chart-4)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="key"
            reversed={isRtl}
            tickFormatter={fmtKey}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            orientation={isRtl ? "right" : "left"}
            width={40}
            tickFormatter={(v: number) => compact.format(v)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            labelFormatter={(key) => fmtKey(String(key))}
            formatter={(value, key) => [
              compact.format(Number(value)),
              key === "visitors" ? labels.visitors : labels.pageviews,
            ]}
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
              key === "visitors" ? labels.visitors : labels.pageviews
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="pageviews"
            stroke="var(--chart-3)"
            strokeWidth={2}
            fill="url(#pvFill)"
          />
          <Area
            type="monotone"
            dataKey="visitors"
            stroke="var(--chart-4)"
            strokeWidth={2}
            fill="url(#visFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
