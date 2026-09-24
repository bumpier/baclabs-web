/**
 * Does SmartTrack read our requests the way we mean them? Sends the sample
 * order from scripts/smarttrack-sample.ts and shows what SmartTrack made of
 * it. Uses the SMARTTRACK_* env of wherever it runs; on the server:
 *
 *   docker compose -f /srv/baclab/docker-compose.yml exec baclab \
 *     npx tsx scripts/check-smarttrack.ts [flags]
 *
 * 1. Always: signs in, and asks get-quotes to price our parcel. Free. The
 *    services and prices that come back show whether SmartTrack reads our
 *    weight and sizes as we mean them (kg and cm).
 * 2. With --send: add-shipment, which adds the shipment WITHOUT generating
 *    a label; get-shipments reads it back, and every field is compared with
 *    what was sent; then void-labels deletes it. On the live account this
 *    also needs --yes-live. Ask SmartTrack first whether an added-then-voided
 *    shipment is ever charged.
 * 3. With --keep as well: the shipment is NOT voided, so the fields
 *    get-shipments does not return (delivery instructions, items, value)
 *    can be checked in the SmartTrack dashboard. Void it afterwards with
 *    --void <reference>.
 *
 * Sample flags (--pack, --qty, --service, ...): see scripts/smarttrack-sample.ts.
 */
import { smartTrackConfig } from "@/lib/smarttrack/config";
import {
  addShipment,
  getQuotes,
  getShipments,
  SmartTrackError,
  testConnection,
  voidLabels,
  type StoredShipment,
} from "@/lib/smarttrack/client";
import type { ShipmentRequest } from "@/lib/smarttrack/client";
import { sampleRequest } from "./smarttrack-sample";

const send = process.argv.includes("--send");
const yesLive = process.argv.includes("--yes-live");
const keep = process.argv.includes("--keep");
const voidRef = process.argv[process.argv.indexOf("--void") + 1];
const voidOnly = process.argv.includes("--void");

function explain(err: unknown): string {
  return err instanceof SmartTrackError ? err.detail : err instanceof Error ? err.message : String(err);
}

/** Same value? Numbers compare as numbers ("0.360" = 0.36), text ignoring case and spacing. */
function same(sent: unknown, stored: unknown): boolean {
  if (typeof sent === "number") return Math.abs(sent - parseFloat(String(stored))) < 0.0005;
  const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  return norm(sent) === norm(stored);
}

function compare(sent: ShipmentRequest, stored: StoredShipment): number {
  const p = sent.parcel[0]!;
  const back = stored.parcels?.[0];
  const rows: [string, unknown, unknown][] = [
    ["service_code", sent.service_code, stored.service_code],
    ["receiver_contact", sent.receiver_contact, stored.receiver_contact],
    ["receiver_address_line_1", sent.receiver_address_line_1, stored.receiver_address_line1],
    ["receiver_address_line_2", sent.receiver_address_line_2 ?? "", stored.receiver_address_line2],
    ["receiver_city", sent.receiver_city, stored.receiver_city],
    ["receiver_postcode", sent.receiver_postcode, stored.receiver_postcode],
    ["receiver_telephone", sent.receiver_telephone ?? "", stored.receiver_telephone],
    ["sender_contact", sent.sender_contact, stored.sender_contact],
    ["sender_company", sent.sender_company ?? "", stored.sender_company],
    ["sender_address_line_1", sent.sender_address_line_1, stored.sender_address_line1],
    ["sender_city", sent.sender_city, stored.sender_city],
    ["sender_postcode", sent.sender_postcode, stored.sender_postcode],
    ["weight (kg)", p.weight, stored.weight],
    ["parcel length (cm)", p.length, back?.length],
    ["parcel width (cm)", p.width, back?.width],
    ["parcel height (cm)", p.height, back?.height],
    ["parcel weight (kg)", p.weight, back?.weight],
  ];
  let mismatches = 0;
  console.log("\n  field                     sent → as SmartTrack stored it");
  for (const [field, a, b] of rows) {
    const ok = same(a, b);
    if (!ok) mismatches++;
    console.log(`  ${ok ? "✓" : "✗"} ${field.padEnd(24)} ${JSON.stringify(a)} → ${b === undefined ? "(not returned)" : JSON.stringify(b)}`);
  }
  console.log(`\n  service as SmartTrack names it: ${stored.service_name ?? "?"}; status: ${stored.consignment_status ?? "?"}`);
  console.log("  Not returned by get-shipments, so not checkable here: description (delivery instructions), items, value.");
  return mismatches;
}

async function main() {
  const cfg = smartTrackConfig();
  if (!cfg) throw new Error("SMARTTRACK_API_KEY and SMARTTRACK_API_SECRET are not set here.");

  // ── 1. Sign in, and price the parcel ─────────────────────────────
  const { env, serviceCount } = await testConnection();
  console.log(`Signed in to SmartTrack ${env.toUpperCase()}: ${serviceCount} service(s) on the account.`);

  if (voidOnly) {
    if (!voidRef?.startsWith("BACLAB-CHECK-")) throw new Error("--void takes a BACLAB-CHECK-… reference from an earlier --keep run");
    await voidLabels([voidRef]);
    console.log(`Voided ${voidRef}.`);
    return;
  }

  const reference = `BACLAB-CHECK-${Date.now()}`;
  const { request, problems, warnings } = sampleRequest(reference);
  if (!request) {
    console.error("The sample would not be sent — fix these first:");
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  for (const w of warnings) console.log(`note: ${w}`);
  const p = request.parcel[0]!;
  console.log(`\nParcel sent as ${p.weight} kg, ${p.length} × ${p.width} × ${p.height} cm, ${request.sender_postcode} → ${request.receiver_postcode}.`);

  try {
    const quotes = await getQuotes({
      origin_country_iso: request.sender_country_iso,
      delivery_country_iso: request.receiver_country_iso,
      origin_city: request.sender_city,
      delivery_city: request.receiver_city,
      origin_postcode: request.sender_postcode,
      delivery_postcode: request.receiver_postcode,
      parcel: [{ weight: p.weight, length: p.length, width: p.width, height: p.height }],
    });
    console.log(`\nget-quotes: ${quotes.length} service(s) would take this parcel.`);
    for (const q of quotes) {
      console.log(`  ${q.service_code.padEnd(14)} ${q.service_name.padEnd(45)} ${q.currency_code} ${q.total}  (${q.transit_time} days)`);
    }
    if (!quotes.some((q) => q.service_code === request.service_code)) {
      console.log(`  ✗ ${request.service_code}, the service being tested, is not among them.`);
    }
  } catch (err) {
    console.log(`\nget-quotes refused the parcel: ${explain(err)}`);
  }

  if (!send) {
    console.log("\nNothing was added. Run again with --send to add the shipment (no label), read it back, and void it.");
    return;
  }
  if (env === "live" && !yesLive) {
    console.log("\nConnected to LIVE. Adding a shipment there needs --yes-live as well as --send.");
    console.log("Ask SmartTrack first whether an added-then-voided shipment (no label) is charged.");
    process.exit(1);
  }

  // ── 2. Add without a label, read back, void ──────────────────────
  console.log(`\nAdding shipment ${reference} (no label) to ${env.toUpperCase()}…`);
  const added = await addShipment(request);
  console.log(`SmartTrack accepted it: shipment number ${added.shipment_number}.`);
  let mismatches = 0;
  try {
    const [stored] = await getShipments([reference]);
    if (!stored) {
      console.log("✗ get-shipments did not return it.");
      mismatches++;
    } else {
      mismatches = compare(request, stored);
    }
  } finally {
    if (keep) {
      console.log("");
      console.log(`Kept ${reference} (--keep). Check it in the SmartTrack dashboard: its description`);
      console.log(`should read "${request.description}". Then void it:`);
      console.log(`  npx tsx scripts/check-smarttrack.ts --void ${reference}`);
    } else {
      try {
        await voidLabels([reference]);
        console.log("");
        console.log(`Voided ${reference}.`);
      } catch (err) {
        console.error("");
        console.error(`!! Could not void ${reference}: ${explain(err)}`);
        console.error("!! Delete it in the SmartTrack dashboard.");
        process.exitCode = 1;
      }
    }
  }
  console.log(
    mismatches === 0
      ? "\n✓ SmartTrack stored every checked field as sent."
      : `\n✗ ${mismatches} field(s) differ — see above.`
  );
  if (mismatches > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nFailed: ${explain(err)}`);
  process.exit(1);
});
