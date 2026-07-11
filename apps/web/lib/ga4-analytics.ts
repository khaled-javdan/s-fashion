import type { TrafficPoint, TrafficRange, TrafficStats } from "./traffic-types"
import { resolveTrafficRange } from "./traffic-types"

export type { TrafficPoint, TrafficStats } from "./traffic-types"

// ---------------------------------------------------------------------------
// OAuth2 refresh-token → short-lived access token
// Avoids service-account JSON keys (blocked by iam.disableServiceAccountKeyCreation).
// One-time setup: get a refresh token via Google OAuth2 Playground (see .env.example).
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) return null

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    })

    if (!res.ok) return null
    const data = (await res.json()) as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// GA4 Data API — runReport
// ---------------------------------------------------------------------------

type GA4Row = {
  dimensionValues: Array<{ value: string }>
  metricValues: Array<{ value: string }>
}

type GA4Response = {
  rows?: GA4Row[]
  totals?: GA4Row[]
}

async function runReport(
  propertyId: string,
  accessToken: string,
  from: string,
  to: string
): Promise<GA4Response | null> {
  try {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: from, endDate: to }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
          dimensions: [{ name: "date" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          metricAggregations: ["TOTAL"],
        }),
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return null
    return (await res.json()) as GA4Response
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API used by the dashboard
// ---------------------------------------------------------------------------

export async function getTrafficStats(range: TrafficRange): Promise<TrafficStats | null> {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) return null

  const accessToken = await getAccessToken()
  if (!accessToken) return null

  const { from, to } = resolveTrafficRange(range)

  const report = await runReport(propertyId, accessToken, from, to)
  if (!report) return null

  // GA4 returns dates as "YYYYMMDD" — normalise to "YYYY-MM-DD"
  const data: TrafficPoint[] = (report.rows ?? []).map((row) => {
    const raw = row.dimensionValues[0]?.value ?? ""
    return {
      key: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      pageviews: parseInt(row.metricValues[0]?.value ?? "0", 10),
      visitors: parseInt(row.metricValues[1]?.value ?? "0", 10),
    }
  })

  const totals = report.totals?.[0]
  const pageviews = parseInt(totals?.metricValues[0]?.value ?? "0", 10)
  const visitors = parseInt(totals?.metricValues[1]?.value ?? "0", 10)

  return { pageviews, visitors, data, from, to, granularity: "1d" }
}
