import type { TrafficPoint, TrafficRange, TrafficStats } from "./traffic-types"
import { resolveTrafficRange } from "./traffic-types"

// ---------------------------------------------------------------------------
// Vercel Web Analytics API (Pro+ plans) — https://vercel.com/docs/analytics/web-analytics-api
// Requires a Vercel access token + the project's Web Analytics to be enabled.
// ---------------------------------------------------------------------------

const API_BASE = "https://api.vercel.com/v1/query/web-analytics"

function authParams(projectId: string): URLSearchParams {
  const params = new URLSearchParams({ projectId })
  const teamId = process.env.VERCEL_TEAM_ID
  if (teamId) params.set("teamId", teamId)
  return params
}

type CountResponse = {
  data?: { pageviews?: number; visitors?: number }
}

async function queryCount(
  token: string,
  projectId: string,
  from: string,
  to: string
): Promise<CountResponse | null> {
  try {
    const params = authParams(projectId)
    params.set("since", from)
    params.set("until", to)

    const res = await fetch(`${API_BASE}/visits/count?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return (await res.json()) as CountResponse
  } catch {
    return null
  }
}

type AggregateRow = { timestamp: string; pageviews: number; visitors: number }
type AggregateResponse = { data?: AggregateRow[] }

async function queryDaily(
  token: string,
  projectId: string,
  from: string,
  to: string
): Promise<AggregateResponse | null> {
  try {
    const params = authParams(projectId)
    params.set("since", from)
    params.set("until", to)
    params.set("by", "day")

    const res = await fetch(`${API_BASE}/visits/aggregate?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return (await res.json()) as AggregateResponse
  } catch {
    return null
  }
}

export async function getTrafficStats(range: TrafficRange): Promise<TrafficStats | null> {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return null

  const { from, to } = resolveTrafficRange(range)

  const [count, daily] = await Promise.all([
    queryCount(token, projectId, from, to),
    queryDaily(token, projectId, from, to),
  ])
  if (!count || !daily) return null

  const data: TrafficPoint[] = (daily.data ?? []).map((row) => ({
    key: row.timestamp.slice(0, 10),
    pageviews: row.pageviews,
    visitors: row.visitors,
  }))

  return {
    pageviews: count.data?.pageviews ?? 0,
    visitors: count.data?.visitors ?? 0,
    data,
    from,
    to,
    granularity: "1d",
  }
}
