/**
 * Test suite for the daily data export (lib/daily-export.ts): who counts as
 * a customer, the CSV cells, the config checks, UK times, and that the zip
 * is AES-encrypted and opens only with its password. Run with
 * `npm run test:daily-export`. Exits non-zero on any failure, like
 * scripts/test-takings.ts. Needs no database.
 */
import { configure, TextWriter, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js";
import { csvCell, toCsv } from "@/lib/csv";
import { customerRows, exportConfig, ukDateTime, zipExport, type CustomerOrder } from "@/lib/daily-export";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const address = (line1: string, postalCode: string) => JSON.stringify({ line1, line2: null, city: "Leeds", postalCode, country: "GB" });
const order = (over: Partial<CustomerOrder>): CustomerOrder => ({
  customerEmail: "jo@example.test",
  customerName: "Jo Bloggs",
  customerPhone: "",
  shippingAddress: address("1 High St", "LS1 1AA"),
  status: "paid",
  kind: "sale",
  paidAt: new Date("2026-10-01T10:00:00Z"),
  amountPaidMinor: 999,
  items: JSON.stringify([{ name: "5-pack", qty: 5 }]),
  ...over,
});

// ── Customers
const rows = customerRows([
  order({ paidAt: new Date("2026-10-01T10:00:00Z"), customerPhone: "07700900000" }),
  order({ customerEmail: "JO@Example.test ", paidAt: new Date("2026-11-01T10:00:00Z"), customerName: "Jo B", shippingAddress: address("9 New Rd", "LS2 2BB"), amountPaidMinor: 1599, items: JSON.stringify([{ name: "10-pack", qty: 10 }]) }),
  order({ customerEmail: "sam@example.test", paidAt: new Date("2026-10-15T10:00:00Z"), status: "shipped" }),
  order({ customerEmail: "cancel@example.test", status: "cancelled" }),
  order({ customerEmail: "unpaid@example.test", status: "pending", paidAt: null }),
  order({ customerEmail: "", paidAt: new Date("2026-10-02T10:00:00Z") }),
  // A plan's later box: a parcel, not an order, and no money.
  order({ kind: "plan_box", paidAt: new Date("2026-10-20T10:00:00Z"), amountPaidMinor: 0 }),
]);
check("one row per paying address", rows.length === 2, rows.map((r) => r.email).join(","));
check("newest customer first", rows[0]?.email === "jo@example.test" && rows[1]?.email === "sam@example.test", rows.map((r) => r.email).join(","));
const jo = rows[0]!;
check("email is lower-cased and trimmed", jo.email === "jo@example.test");
check("contact details come from the latest order", jo.name === "Jo B" && jo.address.startsWith("9 New Rd"), `${jo.name} / ${jo.address}`);
check("a blank field falls back to an earlier order", jo.phone === "07700900000", jo.phone);
check("plan boxes are not orders", jo.orders === 2, String(jo.orders));
check("plan boxes' vials still count", jo.vials === 20, String(jo.vials));
check("total paid sums what was charged", jo.paidMinor === 999 + 1599, String(jo.paidMinor));
check("first and last order dates", jo.firstOrderAt.toISOString() === "2026-10-01T10:00:00.000Z" && jo.lastOrderAt.toISOString() === "2026-11-01T10:00:00.000Z");
check("cancelled and unpaid orders are not customers", !rows.some((r) => r.email.startsWith("cancel") || r.email.startsWith("unpaid")));

// ── CSV
check("cells are quoted", csvCell("a") === '"a"');
check("quotes are doubled", csvCell('say "hi"') === '"say ""hi"""');
check("formulas are defused", csvCell("=HYPERLINK(1)") === `"'=HYPERLINK(1)"` && csvCell("+44 7700") === `"'+44 7700"`);
check("negative numbers stay numbers", csvCell("-3.10") === '"-3.10"' && csvCell(-5) === '"-5"');
check("blanks and booleans", csvCell(null) === '""' && csvCell(undefined) === '""' && csvCell(true) === '"yes"' && csvCell(false) === '"no"');
const sheet = toCsv(["a", "b"], [["1", 2]]);
check("sheet has a BOM, CRLF lines and a trailing CRLF", sheet === '﻿"a","b"\r\n"1","2"\r\n', JSON.stringify(sheet));

// ── Config
const good = exportConfig({ DAILY_EXPORT_TO: " a@example.test, b@example.test ", DAILY_EXPORT_PASSWORD: "a-long-enough-pass" });
check("comma-separated recipients", good.ok && good.config.to.join("|") === "a@example.test|b@example.test");
check("no recipient is refused", !exportConfig({ DAILY_EXPORT_PASSWORD: "a-long-enough-pass" }).ok);
check("a bad address is refused", !exportConfig({ DAILY_EXPORT_TO: "nope", DAILY_EXPORT_PASSWORD: "a-long-enough-pass" }).ok);
check("no password is refused", !exportConfig({ DAILY_EXPORT_TO: "a@example.test" }).ok);
check("a short password is refused", !exportConfig({ DAILY_EXPORT_TO: "a@example.test", DAILY_EXPORT_PASSWORD: "short" }).ok);

// ── UK time
check("summer time is BST", ukDateTime(new Date("2026-07-01T12:05:00Z")) === "2026-07-01 13:05", ukDateTime(new Date("2026-07-01T12:05:00Z")));
check("winter time is GMT", ukDateTime(new Date("2026-11-06T09:30:00Z")) === "2026-11-06 09:30");
check("no date is blank", ukDateTime(null) === "");

// ── The zip
async function zipChecks() {
  configure({ useWebWorkers: false });
  const secret = "customer-name-Zebedee";
  const password = "correct horse battery";
  const zip = await zipExport(
    [
      { name: "customers.csv", data: toCsv(["name"], [[secret]]) },
      { name: "baclab.db", data: new Uint8Array(4096).fill(42) },
    ],
    password
  );
  check("plain text is not visible in the zip", !Buffer.from(zip).includes(secret));

  const reader = new ZipReader(new Uint8ArrayReader(zip), { password });
  const entries = await reader.getEntries();
  check("both files are in it", entries.map((e) => e.filename).join(",") === "customers.csv,baclab.db");
  check("every entry is encrypted", entries.every((e) => e.encrypted));
  const first = entries[0];
  const text = first && !first.directory ? await first.getData(new TextWriter()) : "";
  check("the right password opens it", text.includes(secret), JSON.stringify(text));
  await reader.close();

  const wrong = new ZipReader(new Uint8ArrayReader(zip), { password: "not the password" });
  const [entry] = await wrong.getEntries();
  let refused = false;
  try {
    if (entry && !entry.directory) await entry.getData(new TextWriter());
  } catch {
    refused = true;
  }
  check("a wrong password is refused", refused);
  await wrong.close();

  let shortRefused = false;
  try {
    await zipExport([{ name: "x.csv", data: "x" }], "short");
  } catch {
    shortRefused = true;
  }
  check("zipExport refuses a short password", shortRefused);
}

zipChecks()
  .catch((err) => {
    console.error("  ✗ zip checks threw", err);
    failures++;
  })
  .finally(() => {
    if (failures > 0) {
      console.error(`\n${failures} daily-export check(s) failed`);
      process.exit(1);
    }
    console.log("daily-export: all checks passed");
    process.exit(0);
  });
