/**
 * Re-checks orders marked delivered that no delivery scan ever confirmed,
 * and moves each to where its parcel really is: still delivered (with the
 * real date), shipped, or back to "Label created" (packed). The rules are
 * lib/shipping/delivered-recheck.ts.
 *
 * Every parcel is looked up in SmartTrack, which carries both Royal Mail's
 * and Amazon's scans; Amazon parcels are also looked up on Amazon's own
 * tracker (lib/shipping/amazon-tracking.ts), and a scan either has seen
 * counts. Royal Mail cannot be asked directly (see that file).
 *
 * A dry run unless --apply. Never emails anyone. On the server:
 *
 *   docker compose -f /srv/baclab/docker-compose.yml exec -T baclab \
 *     npx tsx scripts/recheck-delivered.ts [options]
 *
 *   --apply              write the changes (default: only report them)
 *   --carrier amazon     only Amazon parcels (or royalmail)
 *   --order <id>         only this order; the 8-character id from the admin
 *                        is enough. Repeat for more.
 *   --limit N            stop after N parcels
 *   --all                also re-check orders tracking already saw delivered
 *   --skip-amazon        decide on SmartTrack alone, if Amazon's tracker is
 *                        refusing this server
 *   --csv                print the report as CSV on stdout (progress goes to
 *                        stderr), e.g. `... --csv > recheck.csv`
 *   --raw                print both trackers' whole responses
 */
import { prisma } from "@/lib/db";
import { PARCEL_KINDS } from "@/lib/plans/kinds";
import { formatSaleDate, saleTime } from "@/lib/saleTime";
import { smartTrackConfig } from "@/lib/smarttrack/config";
import { getTracking, SmartTrackAuthError, SmartTrackError } from "@/lib/smarttrack/client";
import { parseTrackingNumbers } from "@/lib/shipping/shipments";
import { classifyTracking, parseTracking, TRACKING_STAGE_LABELS, type TrackingSummary } from "@/lib/shipping/tracking";
import { isNoTrackingYet } from "@/lib/shipping/tracking-sync";
import { fetchAmazonTracking, parseAmazonTracking } from "@/lib/shipping/amazon-tracking";
import {
  carrierGroup,
  combineTracking,
  correctionFor,
  type CarrierGroup,
  type RecheckAction,
} from "@/lib/shipping/delivered-recheck";

// ── Options ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const values = (name: string) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));

const apply = flag("--apply");
const all = flag("--all");
const skipAmazon = flag("--skip-amazon");
const csv = flag("--csv");
const raw = flag("--raw");
const limit = Number(values("--limit")[0]) || Infinity;
const orderPrefixes = values("--order").map((v) => v.trim().toLowerCase());
const carrierOnly = values("--carrier")[0]?.toLowerCase().replace(/[^a-z]/g, "") as CarrierGroup | undefined;
if (carrierOnly && !["amazon", "royalmail"].includes(carrierOnly)) {
  console.error('--carrier takes "amazon" or "royalmail".');
  process.exit(1);
}

/** With --csv, stdout is the report alone. */
const say = (line = "") => (csv ? console.error(line) : console.log(line));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const explain = (err: unknown) =>
  err instanceof SmartTrackError ? err.detail : err instanceof Error ? err.message : String(err);
const day = (d: Date | null) => (d ? formatSaleDate(d) : "");

const CARRIER_NAMES: Record<CarrierGroup, string> = { amazon: "Amazon", royalmail: "Royal Mail", other: "Other" };
const ACTION_NAMES: Record<RecheckAction, string> = {
  confirmed: "Delivered (confirmed)",
  shipped: "→ Shipped",
  packed: "→ Label created",
  unchecked: "Left alone (no answer)",
};

interface Row {
  orderId: string;
  sold: string;
  markedHow: string;
  carrier: CarrierGroup;
  number: string;
  smartTrack: string;
  amazon: string;
  action: RecheckAction;
  shippedAt: string;
  deliveredAt: string;
  note: string;
}

// ── Run ─────────────────────────────────────────────────────────────

async function main() {
  const cfg = smartTrackConfig();
  if (!cfg) throw new Error("SmartTrack is not configured here (SMARTTRACK_API_KEY / SMARTTRACK_API_SECRET).");
  if (cfg.env !== "live") throw new Error("SmartTrack is on UAT here. Only LIVE labels are real parcels; run this on the server.");

  const orders = await prisma.order.findMany({
    where: {
      status: "delivered",
      kind: { in: PARCEL_KINDS },
      ...(orderPrefixes.length ? { OR: orderPrefixes.map((p) => ({ id: { startsWith: p } })) } : {}),
    },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      paidAt: true,
      createdAt: true,
      shippedAt: true,
      deliveredAt: true,
      deliveryOption: true,
      // The label tracking would follow: the newest one made.
      shipments: {
        where: { status: "CREATED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          environment: true,
          trackingNumbers: true,
          carrierName: true,
          serviceName: true,
          serviceCode: true,
          trackingStage: true,
        },
      },
    },
  });

  const skipped = { noLabel: 0, notLive: 0, noNumber: 0, alreadyConfirmed: 0, otherCarrier: 0 };
  const targets = orders.flatMap((o) => {
    const s = o.shipments[0];
    if (!s) return skipped.noLabel++, [];
    if (s.environment !== "live") return skipped.notLive++, [];
    const number = parseTrackingNumbers(s.trackingNumbers)[0];
    if (!number) return skipped.noNumber++, [];
    if (s.trackingStage === "delivered" && !all) return skipped.alreadyConfirmed++, [];
    const carrier = carrierGroup(s.carrierName, s.serviceName, s.serviceCode, o.deliveryOption);
    if (carrierOnly && carrier !== carrierOnly) return skipped.otherCarrier++, [];
    return [{ order: o, shipment: s, number, carrier }];
  });
  const todo = targets.slice(0, limit);

  say(`${apply ? "APPLYING" : "DRY RUN (nothing is changed; add --apply to write)"} — no emails are sent either way.`);
  say(`${orders.length} delivered order${orders.length === 1 ? "" : "s"}; checking ${todo.length}.`);
  if (skipped.noLabel) say(`  ${skipped.noLabel} have no label on record, so there is no tracking to check (left alone).`);
  if (skipped.alreadyConfirmed) say(`  ${skipped.alreadyConfirmed} were already confirmed by a delivery scan (--all re-checks them).`);
  if (skipped.notLive) say(`  ${skipped.notLive} have only a UAT (test) label (left alone).`);
  if (skipped.noNumber) say(`  ${skipped.noNumber} have a label with no tracking number (left alone).`);
  if (skipped.otherCarrier) say(`  ${skipped.otherCarrier} are with another carrier than --carrier ${carrierOnly}.`);
  say();

  const rows: Row[] = [];
  let changed = 0;
  let amazonFailures = 0;

  for (const [i, { order, shipment, number, carrier }] of todo.entries()) {
    const now = new Date();
    const notes: string[] = [];

    // SmartTrack: both carriers' scans.
    let smart: TrackingSummary | null = null;
    let carrierName = shipment.carrierName;
    try {
      const data = await getTracking(number);
      if (raw) say(JSON.stringify({ smartTrack: number, data }, null, 2));
      const parsed = parseTracking(data, now);
      smart = classifyTracking(parsed.events);
      carrierName = parsed.carrierName || carrierName;
    } catch (err) {
      if (err instanceof SmartTrackAuthError) throw new Error(`SmartTrack refused the key: ${err.detail}`);
      if (isNoTrackingYet(err)) smart = classifyTracking([]);
      else notes.push(`SmartTrack: ${explain(err)}`);
    }

    // Amazon's own tracker, for Amazon parcels.
    let amazon: TrackingSummary | null = null;
    let amazonText = carrier === "amazon" ? "" : "n/a";
    let amazonFailed = false;
    if (carrier === "amazon" && !skipAmazon) {
      try {
        const data = await fetchAmazonTracking(number);
        if (raw) say(JSON.stringify({ amazon: number, data }, null, 2));
        const parsed = parseAmazonTracking(data, now);
        amazon = parsed?.summary ?? null;
        amazonText = parsed ? `${parsed.status || "no status"} (${TRACKING_STAGE_LABELS[parsed.summary.stage]})` : "doesn't know this number";
      } catch (err) {
        amazonFailed = true;
        amazonFailures++;
        amazonText = "failed";
        notes.push(`Amazon: ${explain(err)}`);
      }
      await pause(300);
    }

    const tracking = combineTracking(smart, amazon);
    let correction = correctionFor(order, tracking);
    // Amazon could not be asked: never take an order back on SmartTrack's
    // word alone without --skip-amazon. It may have seen a scan SmartTrack missed.
    if (amazonFailed && correction.action !== "confirmed") correction = { action: "unchecked", data: null };
    [...(smart?.unknownCodes ?? []), ...(amazon?.unknownCodes ?? [])].forEach((c) => notes.push(`unknown code ${c}`));

    const smartText = smart
      ? `${TRACKING_STAGE_LABELS[smart.stage]}${smart.latest ? ` — ${smart.latest.description}` : ""}`
      : "no answer";
    const row: Row = {
      orderId: order.id,
      sold: day(saleTime(order)),
      // The catch-up button left no date; "Mark as delivered" by hand stamped one.
      markedHow:
        shipment.trackingStage === "delivered"
          ? "tracking scan"
          : order.deliveredAt
            ? `by hand ${day(order.deliveredAt)}`
            : "catch-up button",
      carrier,
      number,
      smartTrack: smartText,
      amazon: amazonText,
      action: correction.action,
      shippedAt: day(correction.data?.shippedAt ?? null),
      deliveredAt: day(correction.data?.deliveredAt ?? null),
      note: notes.join("; "),
    };
    rows.push(row);

    if (apply && correction.data && tracking) {
      const [moved] = await prisma.$transaction([
        prisma.order.updateMany({ where: { id: order.id, status: "delivered" }, data: correction.data }),
        prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            carrierName,
            trackingStage: tracking.stage,
            trackingEvent: tracking.latest?.description || null,
            trackingEventAt: tracking.latest?.at ?? null,
            trackingCheckedAt: now,
          },
        }),
      ]);
      changed += moved.count;
    }

    say(
      `${String(i + 1).padStart(4)}. ${order.id.slice(0, 8)}  sold ${row.sold.padEnd(11)} ${CARRIER_NAMES[carrier].padEnd(10)} ${number}` +
        `\n        SmartTrack: ${smartText}` +
        (carrier === "amazon" ? `\n        Amazon:     ${amazonText}` : "") +
        `\n        ${ACTION_NAMES[correction.action]}${row.note ? `   (${row.note})` : ""}`
    );
    await pause(150);
  }

  // ── Summary ─────────────────────────────────────────────────────────
  say();
  say("Summary");
  for (const carrier of ["amazon", "royalmail", "other"] as const) {
    const mine = rows.filter((r) => r.carrier === carrier);
    if (mine.length === 0) continue;
    const count = (a: RecheckAction) => mine.filter((r) => r.action === a).length;
    say(
      `  ${CARRIER_NAMES[carrier].padEnd(10)} ${String(mine.length).padStart(4)} checked: ` +
        `${count("confirmed")} delivered, ${count("shipped")} → shipped, ${count("packed")} → label created, ${count("unchecked")} left alone`
    );
    // Every parcel "never scanned" more likely means SmartTrack is not
    // getting this carrier's scans than that none of them went out.
    if (mine.length >= 5 && count("packed") === mine.length) {
      say(
        `  ! Not one ${CARRIER_NAMES[carrier]} parcel shows a carrier scan. Before applying, look two or three up by hand on` +
          ` the carrier's site. If they show movement, SmartTrack is not getting ${CARRIER_NAMES[carrier]}'s scans:` +
          ` leave them out with --carrier.`
      );
    }
  }
  if (amazonFailures) {
    say(`  ! Amazon's tracker failed for ${amazonFailures}; those were left alone. Run again, or add --skip-amazon.`);
  }
  if (apply) say(`\n${changed} order${changed === 1 ? "" : "s"} updated.`);
  else say("\nNothing was changed. Run again with --apply to write the above.");

  if (csv) {
    const cols: (keyof Row)[] = [
      "orderId", "sold", "markedHow", "carrier", "number", "smartTrack", "amazon", "action", "shippedAt", "deliveredAt", "note",
    ];
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    console.log(cols.join(","));
    for (const r of rows) console.log(cols.map((c) => cell(String(r[c]))).join(","));
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
