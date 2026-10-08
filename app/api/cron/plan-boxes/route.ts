import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runPlanBoxes, runPlanRenewals } from "@/lib/plans/boxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily job: each monthly-plan box that has fallen due becomes a paid £0
// order with a label (lib/plans/boxes.ts), then the renewal emails go.
// Hit by server cron in the morning, so labels are bought before the
// dispatch cutoff:
//   0 7 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/plan-boxes
// Safe to re-run: a box or an email already made is never made again.

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const boxes = await runPlanBoxes();
  const renewals = await runPlanRenewals();
  console.log(`[cron] plan-boxes: ${boxes.created} made, ${boxes.failed} failed; ${renewals.sent} renewal email(s)`);
  return NextResponse.json({ ...boxes, renewals });
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
