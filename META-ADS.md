# Meta Ads Analytics — Setup Guide

Powers the **Meta Ads** tab on the admin dashboard (`/admin?tab=ads`).

## What's already built

- `lib/meta-ads.ts` — fetches account-level totals + per-campaign breakdown from the Meta Marketing API v21.0. Returns `null` silently when env vars are missing.
- `components/admin/analytics/meta-campaigns-table.tsx` — campaign table (spend, impressions, clicks, CTR, purchases, ROAS).
- Dashboard tab `?tab=ads` with 8 KPI cards + campaigns table. Supports 7/30/90-day presets and custom date ranges (`mrange`/`mfrom`/`mto` URL params).

Two env vars are needed to activate it:

```
META_ADS_ACCESS_TOKEN=""
META_ADS_ACCOUNT_ID=""
```

---

## Step 1 — Get your Ad Account ID

1. Go to [business.facebook.com/adsmanager](https://business.facebook.com/adsmanager)
2. Look at the URL: `?act=123456789`
3. Your account ID is `act_123456789` (keep the `act_` prefix)

---

## Step 2 — Create a Meta Developer Account & App

You need a developer app to generate a system user token.

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with your Facebook account
2. Click **My Apps** → **Create App**
3. Choose **Other** as the use case → **Next**
4. Choose **Business** as the app type → **Next**
5. Fill in app name (e.g. "S Fashion Dashboard"), contact email → **Create App**
6. You don't need to add any products or submit for review — the app just needs to exist

---

## Step 3 — Create a System User and generate a token

System user tokens don't expire, which is why they're preferred over personal user tokens.

1. Go to [business.facebook.com](https://business.facebook.com) → **Settings** (gear icon, bottom left)
2. In the left sidebar under **Users** → click **System Users**
3. Click **Add** → name it (e.g. "Dashboard Reader") → Role: **Employee** → **Create System User**
4. Click the system user → **Add Assets**
5. Select **Ad Accounts** → find your ad account → toggle on **Analyst** → **Save Changes**
6. Back on the system user row, click **Generate New Token**
7. Select the app you created in Step 2
8. Under **Permissions**, check `ads_read` → **Generate Token**
9. Copy the token immediately (it won't be shown again)

---

## Step 4 — Add env vars

### Local development

Add to `.env.local`:

```
META_ADS_ACCESS_TOKEN="your_token_here"
META_ADS_ACCOUNT_ID="act_123456789"
```

### Production (Vercel)

```bash
vercel env add META_ADS_ACCESS_TOKEN production
vercel env add META_ADS_ACCOUNT_ID production
```

---

## Metrics fetched

| Metric | Description |
|---|---|
| Spend | Total amount spent in the ad account's billing currency |
| Reach | Unique people who saw at least one ad |
| Impressions | Total ad impressions |
| Clicks | Total link clicks |
| CTR | Click-through rate (%) |
| CPC | Cost per click |
| Purchases | Purchase events fired by the Meta pixel |
| ROAS | Return on ad spend (purchases value ÷ spend) |

The campaigns table shows the same metrics per campaign, sorted by spend descending.

Data is cached for 5 minutes (`revalidate: 300`). Account currency is auto-detected from the Meta API.

---

## Troubleshooting

- **Tab shows "not configured"** — one or both env vars are missing or empty.
- **Tab shows no campaigns** — the date range has no active campaigns. Try a wider range.
- **Wrong currency** — the currency shown is whatever your Meta ad account is billed in (fetched from `GET /v21.0/{account_id}?fields=currency`). It may be USD even if you sell in AED.
- **Purchases show 0** — the Meta pixel on the storefront must be firing `Purchase` events and be linked to the ad account for conversion data to appear.
