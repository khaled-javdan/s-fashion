export type TrafficPoint = {
  key: string // YYYY-MM-DD
  pageviews: number
  visitors: number
}

export type TrafficStats = {
  pageviews: number
  visitors: number
  data: TrafficPoint[]
  from: string
  to: string
  granularity: "1d"
}

export type TrafficRange = { days: number } | { from: string; to: string }

export function resolveTrafficRange(range: TrafficRange): { from: string; to: string } {
  const now = new Date()
  if ("days" in range) {
    const to = now.toISOString().slice(0, 10)
    if (range.days <= 1) return { from: to, to }
    const d = new Date(now)
    d.setDate(d.getDate() - range.days)
    return { from: d.toISOString().slice(0, 10), to }
  }
  return { from: range.from, to: range.to }
}
