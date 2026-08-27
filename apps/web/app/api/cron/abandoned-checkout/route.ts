/**
 * Abandoned-checkout recovery cron.
 *
 * Emails customers who started a card checkout and never paid — once each,
 * after the configured delay, with the configured discount. All of that lives
 * in the `checkout.abandoned_email` setting, so the shop owner controls it from
 * Settings without a deploy; while it's switched off this route is a no-op.
 *
 * Scheduled every 15 minutes in vercel.json so the "1 hour after they left"
 * delay is actually honoured (a daily cron would turn it into "up to a day
 * later"). The sweep is idempotent, so an extra run costs nothing.
 *
 * Auth matches the sibling cron: `Authorization: Bearer $CRON_SECRET` when the
 * secret is configured, open locally when it isn't.
 */
import { NextResponse } from "next/server";

import { reportError } from "@/lib/errors";
import { sweepAbandonedCheckouts } from "@/lib/services/abandoned-checkout";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sweepAbandonedCheckouts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    reportError("cron.abandoned-checkout", err);
    return NextResponse.json({ error: "sweep_failed" }, { status: 500 });
  }
}
