/**
 * Checks every paid order against its parcel's tracking and says where each
 * really is. Above all it lists the orders whose label was made but which
 * the carrier has never had, whatever the order itself says.
 *
 * Every order paid for and not cancelled is looked at, plan boxes too.
 * Each label is looked up in SmartTrack, which carries both Royal Mail's and
 * Amazon's scans; Amazon parcels are also looked up on Amazon's own tracker
 * (lib/shipping/amazon-tracking.ts), and a scan either has seen counts.
 * Royal Mail cannot be asked directly (see that file). Orders with no label
 * are listed, since nothing can check them.
 *
 * With --apply it also puts back orders marked further on than their parcel
 * (lib/shipping/order-recheck.ts): shipped or delivered with no carrier scan
 * → Label created, delivered while the carrier still has it → Shipped. An
 * order tracking has got further than is left to the tracking cron, which
 * emails the customers still waiting. This script never emails anyone.
 *
 *   docker compose -f /srv/baclab/docker-compose.yml exec -T baclab \
 *     npx tsx scripts/recheck-orders.ts [options]
 *
 *   --apply              put back the orders marked too far on (default: report only)
 *   --status delivered   only orders in this status: paid, packed, shipped or
 *                        delivered. Repeat for more.
 *   --carrier amazon     only Amazon parcels (or royalmail)
 *   --order <id>         only this order; the 8-character id from the admin
 *                        is enough. Repeat for more.
 *   --limit N            ask about at most N labels
 *   --all                also re-ask about orders tracking already saw delivered
 *   --skip-amazon        decide on SmartTrack alone, if Amazon's tracker is
 *                        refusing this server
 *   --csv                print the report as CSV on stdout, one row per order
 *                        (progress goes to stderr), e.g. `... --csv > orders.csv`
 *   --raw                print both trackers' whole responses
 */
import { prisma } from "@/lib/db";
import { PARCEL_KINDS } from "@/lib/plans/kinds";
import { statusLabel } from "@/lib/order-status";
import { formatSaleDate, saleTime } from "@/lib/saleTime";
import { smartTrackConfig } from "@/lib/smarttrack/config";
import { getTracking, SmartTrackAuthError, SmartTrackError } from "@/lib/smarttrack/client";
import { parseTrackingNumbers } from "@/lib/shipping/shipments";
import { classifyTracking, parseTracking, TRACKING_STAGE_LABELS, type TrackingSummary } from "@/lib/shipping/tracking";
import { isNoTrackingYet } from "@/lib/shipping/tracking-sync";
import { fetchAmazonTracking, parseAmazonTracking } from "@/lib/shipping/amazon-tracking";
import {
  BACKWARD,
  carrierGroup,
  combineTracking,
  correctionFor,
  type CarrierGroup,
  type RecheckAction,
} from "@/lib/shipping/order-recheck";

// ── Options ─────────────────────────────────────────────────────────

const SOLD = ["paid", "packed", "shipped", "delivered"];

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
const statuses = values("--status").flatMap((v) => v.split(",")).map((s) => s.trim().toLowerCase()).filter(Boolean);
const carrierOnly = values("--carrier")[0]?.toLowerCase().replace(/[^a-z]/g, "") as CarrierGroup | undefined;
if (carrierOnly && !["amazon", "royalmail"].includes(carrierOnly)) {
  console.error('--carrier takes "amazon" or "royalmail".');
  process.exit(1);
}
if (statuses.some((s) => !SOLD.includes(s))) {
  console.error(`--status takes ${SOLD.join(", ")} ("packed" is Label created).`);
  process.exit(1);
}
const inStatuses = statuses.length ? statuses : SOLD;

/** With --csv, stdout is the report alone. */
const say = (line = "") => (csv ? console.error(line) : console.log(line));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const explain = (err: unknown) =>
  err instanceof SmartTrackError ? err.detail : err instanceof Error ? err.message : String(err);
const day = (d: Date | null) => (d ? formatSaleDate(d) : "");
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const CARRIER_NAMES: Record<CarrierGroup, string> = { amazon: "Amazon", royalmail: "Royal Mail", other: "Other" };

/** Where tracking puts an order, as the report's columns. */
type Column = "awaiting" | "in_transit" | "problem" | "delivered" | "noAnswer" | "noLabel";
const COLUMNS: [Column, string][] = [
  ["awaiting", "Never scanned"],
  ["in_transit", "With carrier"],
  ["problem", "Problem"],
  ["delivered", "Delivered"],
  ["noAnswer", "No answer"],
  ["noLabel", "No label"],
];
const COLUMN_NAMES = Object.fromEntries(COLUMNS) as Record<Column, string>;

const ACTION_NAMES: Record<RecheckAction, string> = {
  confirmed: "delivered, dates from the scan",
  toShipped: "back to Shipped",
  toLabel: "back to Label created",
  agrees: "ok",
  behind: "tracking is further on (the cron moves it)",
  unchecked: "left alone (no answer)",
};

interface Row {
  orderId: string;
  status: string;
  sold: string;
  soldAt: Date;
  carrier: CarrierGroup | "";
  number: string;
  labelMade: string;
  labelAt: Date | null;
  column: Column;
  smartTrack: string;
  amazon: string;
  action: RecheckAction | "";
  newStatus: string;
  shippedAt: string;
  deliveredAt: string;
  labelError: string;
  note: string;
}

// ── Run ─────────────────────────────────────────────────────────────

async function main() {
  const cfg = smartTrackConfig();
  if (!cfg) throw new Error("SmartTrack is not configured here (SMARTTRACK_API_KEY / SMARTTRACK_API_SECRET).");
  if (cfg.env !== "live") throw new Error("SmartTrack is on UAT here. Only LIVE labels are real parcels; run this on the server.");

  const [orders, firstLabel] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: inStatuses },
        kind: { in: PARCEL_KINDS },
        ...(orderPrefixes.length ? { OR: orderPrefixes.map((p) => ({ id: { startsWith: p } })) } : {}),
      },
      orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        paidAt: true,
        createdAt: true,
        shippedAt: true,
        deliveredAt: true,
        deliveryOption: true,
        labelError: true,
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
            createdAt: true,
          },
        },
      },
    }),
    prisma.shipment.findFirst({
      where: { status: "CREATED", environment: "live" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  // Sort every order into a row; the ones with a live label to ask about go on the list.
  let rows: Row[] = [];
  const toAsk: { order: (typeof orders)[number]; shipmentId: string; number: string; carrier: CarrierGroup; row: Row }[] = [];
  for (const o of orders) {
    const base: Row = {
      orderId: o.id,
      status: o.status,
      sold: day(saleTime(o)),
      soldAt: saleTime(o),
      carrier: "",
      number: "",
      labelMade: "",
      labelAt: null,
      column: "noLabel",
      smartTrack: "",
      amazon: "",
      action: "",
      newStatus: "",
      shippedAt: "",
      deliveredAt: "",
      labelError: o.labelError ?? "",
      note: "",
    };
    const s = o.shipments[0];
    const number = s?.environment === "live" ? parseTrackingNumbers(s.trackingNumbers)[0] : undefined;
    if (!s || !number) {
      if (carrierOnly) continue;
      base.note = !s ? "" : s.environment !== "live" ? "test (UAT) label only" : "label has no tracking number";
      rows.push(base);
      continue;
    }
    const carrier = carrierGroup(s.carrierName, s.serviceName, s.serviceCode, o.deliveryOption);
    if (carrierOnly && carrier !== carrierOnly) continue;
    const row: Row = { ...base, carrier, number, labelMade: day(s.createdAt), labelAt: s.createdAt, column: "noAnswer" };
    rows.push(row);
    if (o.status === "delivered" && s.trackingStage === "delivered" && !all) {
      // Tracking moved it there from a delivery scan: nothing to ask.
      Object.assign(row, { column: "delivered", smartTrack: "delivery scan on record", action: "agrees" });
      continue;
    }
    toAsk.push({ order: o, shipmentId: s.id, number, carrier, row });
  }
  const asking = toAsk.slice(0, limit);
  const notAsked = new Set(toAsk.slice(limit).map((t) => t.row));
  rows = rows.filter((r) => !notAsked.has(r));

  say(`${apply ? "APPLYING" : "REPORT ONLY (nothing is changed; --apply puts back the orders marked too far on)"}. No emails are sent.`);
  say(
    `${rows.length} order${rows.length === 1 ? "" : "s"} (${inStatuses.map((s) => statusLabel(s)).join(", ")}); ` +
      `asking about ${asking.length} label${asking.length === 1 ? "" : "s"}` +
      (notAsked.size ? ` (${notAsked.size} more left out by --limit)` : "") +
      "."
  );
  say();

  let changed = 0;
  let amazonFailures = 0;

  for (const [i, { order, shipmentId, number, carrier, row }] of asking.entries()) {
    const now = new Date();
    const notes: string[] = [];

    // SmartTrack: both carriers' scans.
    let smart: TrackingSummary | null = null;
    let carrierName = "";
    try {
      const data = await getTracking(number);
      if (raw) say(JSON.stringify({ smartTrack: number, data }, null, 2));
      const parsed = parseTracking(data, now);
      smart = classifyTracking(parsed.events);
      carrierName = parsed.carrierName;
    } catch (err) {
      if (err instanceof SmartTrackAuthError) throw new Error(`SmartTrack refused the key: ${err.detail}`);
      if (isNoTrackingYet(err)) smart = classifyTracking([]);
      else notes.push(`SmartTrack: ${explain(err)}`);
    }

    // Amazon's own tracker, for Amazon parcels.
    let amazon: TrackingSummary | null = null;
    let amazonFailed = false;
    if (carrier === "amazon" && !skipAmazon) {
      try {
        const data = await fetchAmazonTracking(number);
        if (raw) say(JSON.stringify({ amazon: number, data }, null, 2));
        const parsed = parseAmazonTracking(data, now);
        amazon = parsed?.summary ?? null;
        row.amazon = parsed
          ? `${parsed.status || "no status"} (${TRACKING_STAGE_LABELS[parsed.summary.stage]})`
          : "doesn't know this number";
      } catch (err) {
        amazonFailed = true;
        amazonFailures++;
        row.amazon = "failed";
        notes.push(`Amazon: ${explain(err)}`);
      }
      await pause(300);
    }

    const tracking = combineTracking(smart, amazon);
    let correction = correctionFor(order, tracking);
    // Amazon could not be asked: never take an order back on SmartTrack's
    // word alone without --skip-amazon. Amazon may have seen a scan SmartTrack missed.
    if (amazonFailed && BACKWARD.includes(correction.action)) correction = { action: "unchecked", data: null };
    [...(smart?.unknownCodes ?? []), ...(amazon?.unknownCodes ?? [])].forEach((c) => notes.push(`unknown code ${c}`));

    Object.assign(row, {
      column: tracking ? tracking.stage : "noAnswer",
      smartTrack: smart ? `${TRACKING_STAGE_LABELS[smart.stage]}${smart.latest ? ` — ${smart.latest.description}` : ""}` : "no answer",
      action: correction.action,
      newStatus: correction.data?.status ?? "",
      shippedAt: day(correction.data?.shippedAt ?? null),
      deliveredAt: day(correction.data?.deliveredAt ?? null),
      note: notes.join("; "),
    });

    if (apply && correction.data && tracking) {
      const [moved] = await prisma.$transaction([
        prisma.order.updateMany({ where: { id: order.id, status: order.status }, data: correction.data }),
        prisma.shipment.update({
          where: { id: shipmentId },
          data: {
            ...(carrierName ? { carrierName } : {}),
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
      `${String(i + 1).padStart(4)}/${asking.length}  ${order.id.slice(0, 8)}  ${statusLabel(order.status).padEnd(13)} ` +
        `${CARRIER_NAMES[carrier].padEnd(10)} ${number.padEnd(22)} ${COLUMN_NAMES[row.column].padEnd(13)} → ${ACTION_NAMES[correction.action]}` +
        `\n          SmartTrack: ${row.smartTrack}${row.amazon ? ` · Amazon: ${row.amazon}` : ""}${row.note ? `   (${row.note})` : ""}`
    );
    await pause(150);
  }

  report(rows, firstLabel?.createdAt ?? null);
  if (amazonFailures) {
    say(`\n! Amazon's tracker failed for ${amazonFailures}; any of those that would have gone back were left alone. Run again, or add --skip-amazon.`);
  }

  const count = (a: RecheckAction) => rows.filter((r) => r.action === a).length;
  say(
    `\n${apply ? "Done" : "With --apply"}: ${count("toLabel")} back to Label created, ${count("toShipped")} back to Shipped, ` +
      `${count("confirmed")} delivered given their scan dates.`
  );
  if (apply) say(`${changed} order${changed === 1 ? "" : "s"} updated.`);
  else say("Nothing was changed.");

  if (csv) {
    const cols: (keyof Row)[] = [
      "orderId", "status", "sold", "carrier", "number", "labelMade", "column", "smartTrack", "amazon",
      "action", "newStatus", "shippedAt", "deliveredAt", "labelError", "note",
    ];
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    console.log(cols.join(","));
    for (const r of rows) {
      const out = { ...r, column: COLUMN_NAMES[r.column], status: statusLabel(r.status) };
      console.log(cols.map((c) => cell(String(out[c] ?? ""))).join(","));
    }
  }
}

// ── The report ──────────────────────────────────────────────────────

function report(rows: Row[], labelsSince: Date | null) {
  // Every order: its status down the side, where tracking puts it across.
  say("\nWhere every order is (order status down the side, tracking across)");
  say(`  ${"".padEnd(14)}${COLUMNS.map(([, name]) => name.padStart(14)).join("")}`);
  for (const status of inStatuses) {
    const mine = rows.filter((r) => r.status === status);
    if (mine.length === 0) continue;
    say(`  ${statusLabel(status).padEnd(14)}${COLUMNS.map(([c]) => String(mine.filter((r) => r.column === c).length).padStart(14)).join("")}`);
  }

  const line = (r: Row, extra = "") =>
    `  ${r.orderId.slice(0, 8)}  ${statusLabel(r.status).padEnd(13)} sold ${r.sold.padEnd(11)} ` +
    (r.number ? `label ${r.labelMade.padEnd(11)} ${CARRIER_NAMES[r.carrier as CarrierGroup].padEnd(10)} ${r.number}` : "") +
    extra;

  const neverScanned = rows
    .filter((r) => r.column === "awaiting")
    .sort((a, b) => (a.labelAt?.getTime() ?? 0) - (b.labelAt?.getTime() ?? 0));
  say(`\nLabel made, never scanned by the carrier (${neverScanned.length}), oldest label first:`);
  if (neverScanned.length === 0) say("  None.");
  for (const r of neverScanned) say(line(r, r.action && BACKWARD.includes(r.action) ? `   → ${ACTION_NAMES[r.action]}` : ""));

  const problems = rows.filter((r) => r.column === "problem");
  if (problems.length) {
    say(`\nThe carrier reports a problem (${problems.length}):`);
    for (const r of problems) say(line(r, `   ${r.smartTrack}`));
  }

  const noLabel = rows.filter((r) => r.column === "noLabel");
  const sinceLabels = labelsSince ? noLabel.filter((r) => r.soldAt >= labelsSince) : noLabel;
  say(
    `\nNo label, so no tracking to check (${noLabel.length})` +
      (labelsSince ? `; ${sinceLabels.length} sold since labels were first bought here on ${day(labelsSince)}:` : ":")
  );
  if (sinceLabels.length === 0) say("  None.");
  for (const r of sinceLabels) {
    say(line(r, r.labelError ? `  label failed: ${short(r.labelError, 90)}` : r.note ? `  ${r.note}` : "  no label made"));
  }
  if (noLabel.length > sinceLabels.length) {
    say(`  …and ${noLabel.length - sinceLabels.length} sold before then, sent before labels were bought here.`);
  }

  const noAnswer = rows.filter((r) => r.column === "noAnswer");
  if (noAnswer.length) {
    say(`\nNo answer from tracking (${noAnswer.length}), left alone:`);
    for (const r of noAnswer) say(line(r, r.note ? `   ${short(r.note, 90)}` : ""));
  }

  const behind = rows.filter((r) => r.action === "behind").length;
  if (behind) {
    say(
      `\n${behind} order${behind === 1 ? " is" : "s are"} further on in tracking than ${behind === 1 ? "it shows" : "they show"}.` +
        " The tracking cron moves them forward (or press Check tracking on /admin/shipping/catch-up)."
    );
  }

  // Every parcel "never scanned" more likely means SmartTrack is not
  // getting this carrier's scans than that none of them went out.
  for (const carrier of ["amazon", "royalmail"] as const) {
    const mine = rows.filter((r) => r.carrier === carrier && r.column !== "noAnswer");
    if (mine.length >= 5 && mine.every((r) => r.column === "awaiting")) {
      say(
        `\n! Not one ${CARRIER_NAMES[carrier]} parcel shows a carrier scan. Look two or three up by hand on the carrier's` +
          ` site before applying. If they show movement, SmartTrack is not getting ${CARRIER_NAMES[carrier]}'s scans:` +
          ` leave them out with --carrier.`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
