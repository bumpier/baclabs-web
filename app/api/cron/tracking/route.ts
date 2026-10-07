import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { syncTracking } from "@/lib/shipping/tracking-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One SmartTrack call per label, one at a time, stopping after a minute.
export const maxDuration = 300;

// Moves orders on from SmartTrack tracking: first carrier scan → shipped
// (tracking email), delivery scan → delivered. Every 30 minutes:
//   */30 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/tracking
// Each label is checked at most hourly and claimed before it is checked, so
// overlapping runs are harmless. Does nothing unless SmartTrack is LIVE and
// tracking updates are on (Shipping page). See lib/shipping/tracking-sync.ts.

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncTracking({ limit: 80 });
  if (result.shipped || result.delivered || result.errors) {
    console.log(
      `[cron] tracking: ${result.checked} checked, ${result.shipped} shipped, ${result.delivered} delivered, ${result.errors} errors`
    );
  }
  return NextResponse.json(result);
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
