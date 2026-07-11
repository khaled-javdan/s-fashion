import type { TrafficRange, TrafficStats } from "./traffic-types"
import { getTrafficStats as getGa4TrafficStats } from "./ga4-analytics"
import { getTrafficStats as getVercelTrafficStats } from "./vercel-analytics"

export type { TrafficStats } from "./traffic-types"

/**
 * Switch between traffic providers via `TRAFFIC_ANALYTICS_PROVIDER` ("vercel" | "ga4").
 * Defaults to "vercel" (Web Analytics API, requires Pro+ plan). Set to "ga4" to fall
 * back to the Google Analytics 4 integration instead.
 */
export async function getTrafficStats(range: TrafficRange): Promise<TrafficStats | null> {
  const provider = process.env.TRAFFIC_ANALYTICS_PROVIDER === "ga4" ? "ga4" : "vercel"
  return provider === "ga4" ? getGa4TrafficStats(range) : getVercelTrafficStats(range)
}
