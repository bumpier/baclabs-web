import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runWelcomeReminders } from "@/lib/welcome-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reminds subscribers whose welcome vial is still unused: once after
// MAILING_LIST.reminders.firstAfterHours, and once more, with the bonus,
// after secondAfterHours (lib/welcome-reminders.ts). Every 15 minutes, so a
// reminder lands close to the hour of day its subscriber signed up at:
//   */15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/welcome-reminders
// Each reminder is claimed before it is sent, so overlapping runs and re-runs
// are harmless.

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const run = await runWelcomeReminders();
  if (run.first + run.second + run.failed > 0) {
    console.log(`[cron] welcome reminders: ${run.first} first, ${run.second} second, ${run.failed} failed`);
  }
  return NextResponse.json(run);
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
