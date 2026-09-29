import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { resumeSendingCampaigns } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A large audience is sent in batches of 100 with a pause between them.
export const maxDuration = 300;

// Resumes any campaign left part-way through sending: a deploy or a restart
// mid-send leaves recipients queued, and this sends them. Every 5 minutes:
//   */5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/campaigns
// Safe to overlap with a send already running: see processCampaign().

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const resumed = await resumeSendingCampaigns();
  if (resumed > 0) console.log(`[cron] campaigns: resumed ${resumed}`);
  return NextResponse.json({ resumed });
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
