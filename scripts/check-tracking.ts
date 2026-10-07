/**
 * What does SmartTrack's tracking say for real parcels, and what does
 * lib/shipping/tracking.ts make of it? Read-only: get-tracking and
 * get-shipments only, nothing is changed here or at SmartTrack. Uses the
 * SMARTTRACK_* env of wherever it runs; on the server:
 *
 *   docker compose -f /srv/baclab/docker-compose.yml exec baclab \
 *     npx tsx scripts/check-tracking.ts [tracking numbers…] [--recent N] [--raw]
 *
 * With no numbers, it takes the N most recent labels in the database for
 * the connected environment (default 5). --raw prints SmartTrack's whole
 * response for each.
 *
 * Run it before trusting the event codes in lib/shipping/tracking.ts: look
 * for "unknown codes", and check that a parcel known to have been delivered
 * comes out "delivered".
 */
import { prisma } from "@/lib/db";
import { smartTrackConfig } from "@/lib/smarttrack/config";
import { getShipments, getTracking, SmartTrackError } from "@/lib/smarttrack/client";
import { parseTrackingNumbers } from "@/lib/shipping/shipments";
import { classifyTracking, parseTracking } from "@/lib/shipping/tracking";

const args = process.argv.slice(2);
const raw = args.includes("--raw");
const recentAt = args.indexOf("--recent");
const recent = recentAt >= 0 ? Number(args[recentAt + 1]) || 5 : 5;
const numbersGiven = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--recent");

function explain(err: unknown): string {
  return err instanceof SmartTrackError ? err.detail : err instanceof Error ? err.message : String(err);
}

async function main() {
  const cfg = smartTrackConfig();
  if (!cfg) {
    console.error("SmartTrack is not configured here (SMARTTRACK_API_KEY / SMARTTRACK_API_SECRET).");
    process.exit(1);
  }
  console.log(`SmartTrack ${cfg.env.toUpperCase()}\n`);

  let targets: { number: string; reference?: string; orderStatus?: string }[] = numbersGiven.map((number) => ({ number }));
  if (targets.length === 0) {
    const rows = await prisma.shipment.findMany({
      where: { status: "CREATED", environment: cfg.env, trackingNumbers: { not: "[]" } },
      orderBy: { createdAt: "desc" },
      take: recent,
      select: { reference: true, trackingNumbers: true, order: { select: { status: true } } },
    });
    targets = rows.flatMap((r) => {
      const number = parseTrackingNumbers(r.trackingNumbers)[0];
      return number ? [{ number, reference: r.reference, orderStatus: r.order.status }] : [];
    });
    if (targets.length === 0) {
      console.log(`No ${cfg.env.toUpperCase()} labels with tracking numbers in the database. Pass numbers instead.`);
      return;
    }
  }

  for (const t of targets) {
    console.log(`── ${t.number}${t.reference ? `  (label ${t.reference}, order ${t.orderStatus})` : ""}`);
    try {
      const data = await getTracking(t.number);
      if (raw) console.log(JSON.stringify(data, null, 2));
      const parsed = parseTracking(data);
      const s = classifyTracking(parsed.events);
      console.log(`   carrier: ${parsed.carrierName || "(none given)"}`);
      for (const e of parsed.events) {
        console.log(`   ${e.at.toISOString()}  ${e.code.padEnd(4)} ${e.description}`);
      }
      console.log(
        `   → ${s.stage}` +
          (s.shippedAt ? `, shipped ${s.shippedAt.toISOString()}` : "") +
          (s.deliveredAt ? `, delivered ${s.deliveredAt.toISOString()}` : "")
      );
      if (s.unknownCodes.length) console.log(`   ! unknown codes: ${s.unknownCodes.join(", ")}`);
    } catch (err) {
      console.log(`   get-tracking: ${explain(err)}`);
    }
    if (t.reference) {
      try {
        const [stored] = await getShipments([t.reference]);
        console.log(`   get-shipments consignment_status: ${stored?.consignment_status ?? "(not returned)"}`);
      } catch (err) {
        console.log(`   get-shipments: ${explain(err)}`);
      }
    }
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
