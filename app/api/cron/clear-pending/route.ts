import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { clearAbandonedCheckouts, describeClearResult } from "@/lib/payments/abandoned";

export const dynamic = "force-dynamic";

// Nightly job: delete pending orders that can no longer be paid — see
// lib/payments/abandoned.ts for what counts. Hit by server cron at midnight:
//   0 0 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/clear-pending
// Safe to re-run: each run only deletes what is abandoned at that moment.

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await clearAbandonedCheckouts();
  console.log(`[cron] clear-pending: ${describeClearResult(result)}`);
  return NextResponse.json(result);
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
