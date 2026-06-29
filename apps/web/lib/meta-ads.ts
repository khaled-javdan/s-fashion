export type MetaCampaign = {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
  ctr: number    // percentage, e.g. 1.97 = 1.97%
  cpc: number
  purchases: number
  roas: number
}

export type MetaAdsStats = {
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpc: number
  purchases: number
  roas: number
  currency: string
  campaigns: MetaCampaign[]
  from: string
  to: string
}

type MetaAction = { action_type: string; value: string }

type MetaInsightRow = {
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  ctr?: string
  cpc?: string
  actions?: MetaAction[]
  purchase_roas?: MetaAction[]
  campaign_id?: string
  campaign_name?: string
}

type MetaInsightsResponse = {
  data: MetaInsightRow[]
}

type MetaAccountResponse = {
  currency?: string
}

function parsePurchases(actions: MetaAction[] | undefined): number {
  // Meta returns different action type strings across API versions
  for (const type of ["purchase", "offsite_conversion.fb.pixel.purchase", "omni_purchase"]) {
    const val = parseInt(actions?.find((a) => a.action_type === type)?.value ?? "0", 10)
    if (val > 0) return val
  }
  return 0
}

function parseRoas(roas: MetaAction[] | undefined): number {
  return parseFloat(roas?.[0]?.value ?? "0")
}

async function fetchInsights(
  accountId: string,
  accessToken: string,
  timeRange: { since: string; until: string },
  level?: "campaign"
): Promise<MetaInsightsResponse | null> {
  const baseFields = ["spend", "impressions", "reach", "clicks", "ctr", "cpc", "actions", "purchase_roas"]
  const fields = level === "campaign"
    ? ["campaign_id", "campaign_name", ...baseFields].join(",")
    : baseFields.join(",")

  const params = new URLSearchParams({
    fields,
    time_range: JSON.stringify(timeRange),
    access_token: accessToken,
    ...(level ? { level } : {}),
  })

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/insights?${params}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    return (await res.json()) as MetaInsightsResponse
  } catch {
    return null
  }
}

async function fetchAccountCurrency(
  accountId: string,
  accessToken: string
): Promise<string> {
  try {
    const params = new URLSearchParams({ fields: "currency", access_token: accessToken })
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}?${params}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return "USD"
    const data = (await res.json()) as MetaAccountResponse
    return data.currency ?? "USD"
  } catch {
    return "USD"
  }
}

export async function getMetaAdsStats(
  range: { days: number } | { from: string; to: string }
): Promise<MetaAdsStats | null> {
  const accountId = process.env.META_ADS_ACCOUNT_ID
  const accessToken = process.env.META_ADS_ACCESS_TOKEN
  if (!accountId || !accessToken) return null

  const now = new Date()
  let from: string, to: string

  if ("days" in range) {
    to = now.toISOString().slice(0, 10)
    const d = new Date(now)
    d.setDate(d.getDate() - range.days + 1)
    from = d.toISOString().slice(0, 10)
  } else {
    from = range.from
    to = range.to
  }

  const timeRange = { since: from, until: to }

  const [accountRes, campaignRes, currency] = await Promise.all([
    fetchInsights(accountId, accessToken, timeRange),
    fetchInsights(accountId, accessToken, timeRange, "campaign"),
    fetchAccountCurrency(accountId, accessToken),
  ])

  if (!accountRes) return null

  const totals = accountRes.data[0]

  const campaigns: MetaCampaign[] = (campaignRes?.data ?? [])
    .map((row) => ({
      id: row.campaign_id ?? "",
      name: row.campaign_name ?? "—",
      spend: parseFloat(row.spend ?? "0"),
      impressions: parseInt(row.impressions ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
      ctr: parseFloat(row.ctr ?? "0"),
      cpc: parseFloat(row.cpc ?? "0"),
      purchases: parsePurchases(row.actions),
      roas: parseRoas(row.purchase_roas),
    }))
    .sort((a, b) => b.spend - a.spend)

  return {
    spend: parseFloat(totals?.spend ?? "0"),
    impressions: parseInt(totals?.impressions ?? "0", 10),
    reach: parseInt(totals?.reach ?? "0", 10),
    clicks: parseInt(totals?.clicks ?? "0", 10),
    ctr: parseFloat(totals?.ctr ?? "0"),
    cpc: parseFloat(totals?.cpc ?? "0"),
    purchases: parsePurchases(totals?.actions),
    roas: parseRoas(totals?.purchase_roas),
    currency,
    campaigns,
    from,
    to,
  }
}
