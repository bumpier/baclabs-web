/**
 * Every Amazon parcel that should have arrived by Monday 12 October 2026
 * and, as far as tracking knows, hasn't: who it is for, where it is going
 * and its tracking number, so each one can be chased.
 *
 * Amazon is next day, and parcels from Friday afternoon should have gone
 * out on the Sunday, so every parcel whose label was made before the Monday
 * should have been delivered by the end of it. Each order whose newest
 * label is an Amazon one made before then is looked up in SmartTrack and on
 * Amazon's own tracker (lib/shipping/amazon-tracking.ts); a scan either has
 * seen counts, as in scripts/recheck-orders.ts.
 *
 * Also listed: parcels delivered after the Monday, parcels tracking gave no
 * answer for, and orders that chose next day but never got a label (nothing
 * can check those). Orders sold before 1 Oct 2026 went out by hand, outside
 * SmartTrack, and are left out.
 *
 * Report only: nothing is changed and nobody is emailed.
 *
 *   docker compose -f /srv/baclab/docker-compose.yml exec -T baclab \
 *     npx tsx scripts/amazon-not-delivered.ts [options]
 *
 *   --before 2026-10-12  the day every parcel labelled before it should have
 *                        arrived by (default 2026-10-12, a Monday)
 *   --by-hand-before 2026-10-01
 *                        orders sold before this UK day were sent by hand
 *                        and are left out (default 2026-10-01)
 *   --skip-amazon        decide on SmartTrack alone, if Amazon's tracker is
 *                        refusing this server
 *   --csv                print the listed orders as CSV on stdout (everything
 *                        else goes to stderr), e.g. `... --csv > amazon.csv`
 */
import { prisma } from "@/lib/db";
import { PARCEL_KINDS } from "@/lib/plans/kinds";
import { statusLabel } from "@/lib/order-status";
import { formatSaleClock, formatSaleDate, formatShopDay, parseDayKey, saleTime, shopDayBounds } from "@/lib/saleTime";
import { formatDeliveryDay } from "@/lib/delivery-date";
import { deliveryOptionById } from "@/config/funnel";
import { smartTrackConfig } from "@/lib/smarttrack/config";
import { getTracking, SmartTrackAuthError, SmartTrackError } from "@/lib/smarttrack/client";
import { parseTrackingNumbers } from "@/lib/shipping/shipments";
import { classifyTracking, parseTracking, type TrackingSummary } from "@/lib/shipping/tracking";
import { isNoTrackingYet } from "@/lib/shipping/tracking-sync";
import { fetchAmazonTracking, parseAmazonTracking } from "@/lib/shipping/amazon-tracking";
import { combineTracking } from "@/lib/shipping/order-recheck";
import { carrierGroup, carrierTrackingUrl } from "@/lib/shipping/carriers";

// ── Options ─────────────────────────────────────────────────────────

const SOLD = ["paid", "packed", "shipped", "delivered"];

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1]?.trim() : undefined;
};

function dayOption(name: string, fallback: string): string {
  const day = parseDayKey(value(name) ?? fallback);
  if (!day) {
    console.error(`${name} takes a date, ${fallback}.`);
    process.exit(1);
  }
  return day;
}

const csv = flag("--csv");
const skipAmazon = flag("--skip-amazon");
const dueDay = dayOption("--before", "2026-10-12");
const byHandDay = dayOption("--by-hand-before", "2026-10-01");
if (byHandDay >= dueDay) {
  console.error("--by-hand-before must come before --before.");
  process.exit(1);
}
/** Labels made before this went out before the due day. */
const sentBefore = shopDayBounds(dueDay).start;
/** Delivered before this was on time. */
const dueBy = shopDayBounds(dueDay).end;
/** Orders sold before this went out by hand, outside SmartTrack. */
const byHandBefore = shopDayBounds(byHandDay).start;

/** With --csv, stdout is the CSV alone. */
const say = (line = "") => (csv ? console.error(line) : console.log(line));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const explain = (err: unknown) =>
  err instanceof SmartTrackError ? err.detail : err instanceof Error ? err.message : String(err);
const when = (d: Date | null) => (d ? `${formatSaleDate(d)} ${formatSaleClock(d)}` : "");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Where a parcel is, as this report sorts it. */
type Verdict = "notCollected" | "withAmazon" | "problem" | "late" | "onTime" | "noAnswer" | "noLabel";
const VERDICT_NAMES: Record<Verdict, string> = {
  notCollected: "Not collected by Amazon",
  withAmazon: "With Amazon, not delivered",
  problem: "Amazon reports a problem",
  late: "Delivered late",
  onTime: "Delivered on time",
  noAnswer: "Tracking gave no answer",
  noLabel: "Chose next day, no label",
};

function verdictOf(tracking: TrackingSummary | null): Verdict {
  if (!tracking) return "noAnswer";
  if (tracking.stage === "awaiting") return "notCollected";
  if (tracking.stage === "in_transit") return "withAmazon";
  if (tracking.stage === "problem") return "problem";
  // Delivered with no scan time (Amazon's one-word status alone) counts as on time.
  return tracking.deliveredAt && tracking.deliveredAt >= dueBy ? "late" : "onTime";
}

interface Address {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
}

/** The address as stored (from Stripe, so untrusted), read without trusting its shape. */
function readAddress(raw: string): Address {
  let a: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object") a = parsed as Record<string, unknown>;
  } catch {
    // Left blank: the report says there is no address.
  }
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { line1: text(a.line1), line2: text(a.line2), city: text(a.city), postcode: text(a.postalCode), country: text(a.country) };
}

const addressLine = (a: Address) =>
  [a.line1, a.line2, a.city, a.postcode, a.country].filter(Boolean).join(", ") || "(no address on the order)";

interface Row {
  orderId: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  soldAt: Date;
  number: string;
  labelAt: Date | null;
  verdict: Verdict;
  latest: string;
  latestAt: Date | null;
  deliveredAt: Date | null;
  amazonStatus: string;
  note: string;
}

// ── Run ─────────────────────────────────────────────────────────────

async function main() {
  const cfg = smartTrackConfig();
  if (!cfg) throw new Error("SmartTrack is not configured here (SMARTTRACK_API_KEY / SMARTTRACK_API_SECRET).");
  if (cfg.env !== "live") throw new Error("SmartTrack is on UAT here. Only LIVE labels are real parcels; run this on the server.");

  const orders = await prisma.order.findMany({
    where: { status: { in: SOLD }, kind: { in: PARCEL_KINDS } },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      paidAt: true,
      createdAt: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      shippingAddress: true,
      deliveryOption: true,
      labelError: true,
      // The label the parcel went on: the newest one made.
      shipments: {
        where: { status: "CREATED", environment: "live" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { trackingNumbers: true, carrierName: true, serviceName: true, serviceCode: true, createdAt: true },
      },
    },
  });

  const rows: Row[] = [];
  const toAsk: Row[] = [];
  for (const o of orders) {
    const soldAt = saleTime(o);
    if (soldAt < byHandBefore || soldAt >= sentBefore) continue;
    const s = o.shipments[0];
    const number = s ? parseTrackingNumbers(s.trackingNumbers)[0] : undefined;
    const chose = deliveryOptionById(o.deliveryOption)?.carrier;
    const base: Row = {
      orderId: o.id,
      status: o.status,
      name: o.customerName.trim(),
      email: o.customerEmail.trim(),
      phone: o.customerPhone.trim(),
      address: readAddress(o.shippingAddress),
      soldAt,
      number: "",
      labelAt: null,
      verdict: "noLabel",
      latest: "",
      latestAt: null,
      deliveredAt: null,
      amazonStatus: "",
      note: "",
    };
    if (!s || !number) {
      if (carrierGroup(chose) !== "amazon") continue;
      const note = o.labelError ? `label failed: ${o.labelError}` : s ? "label has no tracking number" : "no label made";
      rows.push({ ...base, note });
      continue;
    }
    if (carrierGroup(s.carrierName, s.serviceName, s.serviceCode, chose) !== "amazon") continue;
    // Labelled on or after the due day: it went out then, so wasn't due yet.
    if (s.createdAt >= sentBefore) continue;
    const row: Row = { ...base, number, labelAt: s.createdAt, verdict: "noAnswer" };
    rows.push(row);
    toAsk.push(row);
  }

  say(
    `Amazon parcels labelled before ${formatShopDay(dueDay)}, which should all have arrived by the end of that day` +
      ` (orders from ${formatShopDay(byHandDay)}; earlier ones went out by hand).`
  );
  say(`Checked with SmartTrack${skipAmazon ? "" : " and Amazon's own tracker"}. Report only: nothing is changed and nobody is emailed.`);
  say();

  let amazonFailures = 0;
  for (const [i, row] of toAsk.entries()) {
    process.stderr.write(`\rChecking ${i + 1}/${toAsk.length}…`);
    const now = new Date();
    const notes: string[] = [];

    let smart: TrackingSummary | null = null;
    try {
      smart = classifyTracking(parseTracking(await getTracking(row.number), now).events);
    } catch (err) {
      if (err instanceof SmartTrackAuthError) throw new Error(`SmartTrack refused the key: ${err.detail}`);
      if (isNoTrackingYet(err)) smart = classifyTracking([]);
      else notes.push(`SmartTrack: ${explain(err)}`);
    }

    let amazon: TrackingSummary | null = null;
    if (!skipAmazon) {
      try {
        const parsed = parseAmazonTracking(await fetchAmazonTracking(row.number), now);
        amazon = parsed?.summary ?? null;
        row.amazonStatus = parsed ? parsed.status : "doesn't know this number";
      } catch (err) {
        amazonFailures++;
        notes.push(`Amazon's tracker failed: ${explain(err)}`);
      }
      await pause(300);
    }

    const tracking = combineTracking(smart, amazon);
    Object.assign(row, {
      verdict: verdictOf(tracking),
      latest: tracking?.latest?.description ?? "",
      latestAt: tracking?.latest?.at ?? null,
      deliveredAt: tracking?.deliveredAt ?? null,
      note: notes.join("; "),
    });
    await pause(150);
  }
  if (toAsk.length) process.stderr.write(`\r${" ".repeat(30)}\r`);

  const byLabel = (a: Row, b: Row) => (a.labelAt ?? a.soldAt).getTime() - (b.labelAt ?? b.soldAt).getTime();
  const pick = (...verdicts: Verdict[]) => rows.filter((r) => verdicts.includes(r.verdict)).sort(byLabel);
  const notDelivered = pick("notCollected", "withAmazon", "problem");
  const late = pick("late");
  const noAnswer = pick("noAnswer");
  const noLabel = pick("noLabel");
  const onTime = pick("onTime");
  const count = (list: Row[], v: Verdict) => list.filter((r) => r.verdict === v).length;

  const section = (title: string, list: Row[]) => {
    if (list.length === 0) return;
    say(`${title} (${list.length}), oldest first`);
    say("─".repeat(70));
    list.forEach((r, i) => say(entry(r, i + 1) + "\n"));
  };

  section("NOT DELIVERED", notDelivered);
  if (count(notDelivered, "notCollected")) {
    say(
      "Not collected: Amazon has never scanned this label. Either the parcel is still at fulfilment or it went out" +
        " on a different label; ask fulfilment before telling the customer.\n"
    );
  }
  section(`DELIVERED AFTER ${formatDeliveryDay(dueDay).toUpperCase()}`, late);
  section("TRACKING GAVE NO ANSWER", noAnswer);
  section("CHOSE NEXT DAY BUT HAVE NO LABEL, SO NOTHING TO TRACK", noLabel);

  say(`Of ${plural(toAsk.length, "Amazon parcel")} labelled before ${formatDeliveryDay(dueDay)}:`);
  say(`  ${onTime.length} delivered on time`);
  say(`  ${late.length} delivered late`);
  say(
    `  ${notDelivered.length} not delivered (${count(notDelivered, "notCollected")} not collected,` +
      ` ${count(notDelivered, "withAmazon")} with Amazon, ${count(notDelivered, "problem")} with a problem)`
  );
  if (noAnswer.length) say(`  ${noAnswer.length} tracking gave no answer for`);
  if (noLabel.length) say(`Plus ${plural(noLabel.length, "order")} that chose next day and never got a label.`);
  if (amazonFailures) say(`\n! Amazon's tracker failed for ${amazonFailures}. Run again, or add --skip-amazon.`);

  if (csv) {
    const header = [
      "order", "site status", "tracking says", "name", "email", "phone", "address line 1", "address line 2", "city",
      "postcode", "country", "tracking number", "tracking link", "sold", "label made", "latest event",
      "latest event at", "delivered at", "amazon status", "note",
    ];
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    console.log(header.join(","));
    for (const r of [...notDelivered, ...late, ...noAnswer, ...noLabel]) {
      const a = r.address;
      console.log(
        [
          r.orderId, statusLabel(r.status), VERDICT_NAMES[r.verdict], r.name, r.email, r.phone, a.line1, a.line2, a.city,
          a.postcode, a.country, r.number, r.number ? (carrierTrackingUrl("amazon", r.number) ?? "") : "", when(r.soldAt),
          when(r.labelAt), r.latest, when(r.latestAt), when(r.deliveredAt), r.amazonStatus, r.note,
        ]
          .map(cell)
          .join(",")
      );
    }
  }
}

/** One order: who, where, and where its parcel is. */
function entry(r: Row, n: number): string {
  const lines = [
    `${String(n).padStart(3)}. ${r.orderId.slice(0, 8)}  ${r.name || "(no name)"}  ${r.email}${r.phone ? `  ${r.phone}` : ""}`,
    `     ${addressLine(r.address)}`,
  ];
  if (!r.number) {
    lines.push(`     Sold ${when(r.soldAt)} · site says ${statusLabel(r.status)} · ${r.note}`);
    return lines.join("\n");
  }
  const latest = r.latest ? `${r.latest} (${when(r.latestAt)})` : "no scans";
  lines.push(
    `     Tracking ${r.number} · label made ${when(r.labelAt)} · site says ${statusLabel(r.status)}`,
    `     ${VERDICT_NAMES[r.verdict]}${r.verdict === "late" ? ` ${when(r.deliveredAt)}` : ""}. Latest: ${latest}` +
      (r.amazonStatus ? ` · Amazon: ${r.amazonStatus}` : ""),
    `     ${carrierTrackingUrl("amazon", r.number)}`
  );
  if (r.note) lines.push(`     (${r.note})`);
  return lines.join("\n");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
