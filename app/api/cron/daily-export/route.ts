import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { exportConfig, sendDailyExport } from "@/lib/daily-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily job: every customer, order, mailing-list subscriber and stock count,
// plus a copy of the database, in one AES-256 zip emailed to DAILY_EXPORT_TO
// (lib/daily-export.ts). Hit by server cron:
//   30 6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/daily-export
// Each run sends a fresh email; running it twice sends two.

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cfg = exportConfig();
  if (!cfg.ok) {
    console.error(`[cron] daily-export: not sent, ${cfg.error}`);
    return NextResponse.json({ error: cfg.error }, { status: 503 });
  }
  try {
    const result = await sendDailyExport(cfg.config);
    if (!result.ok) {
      console.error(`[cron] daily-export: not sent, ${result.error}`);
      return NextResponse.json(result, { status: 502 });
    }
    console.log(
      `[cron] daily-export: emailed ${result.files.length} files (${result.bytes} bytes${result.databaseIncluded ? "" : ", database left out: too large"}) to ${cfg.config.to.length} address(es)`
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron] daily-export failed", err);
    return NextResponse.json({ error: "export failed, see logs" }, { status: 500 });
  }
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
