import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { configure, TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";
import { brand } from "@/config/brand";
import { toCsv } from "@/lib/csv";
import { SOLD_STATUSES } from "@/lib/dailyTakings";
import { prisma } from "@/lib/db";
import { escapeHtml, layout, send } from "@/lib/email";
import { getInventoryMode } from "@/lib/inventory/mode";
import { normEmail, subscriberRows } from "@/lib/mailing-list";
import { carriesRevenue, countsAsOrder, orderKind, shipsParcel } from "@/lib/plans/kinds";
import { formatShopDay, SHOP_TIME_ZONE, shopDayKey } from "@/lib/saleTime";
import { loadVialStock, vialsOnOrder } from "@/lib/vial-stock";

/**
 * The daily data export (/api/cron/daily-export): every customer, order,
 * mailing-list subscriber and stock count as spreadsheets, plus a copy of
 * the whole database, in one AES-256 zip emailed to DAILY_EXPORT_TO.
 *
 * The zip is always encrypted. The password lives only in the server's
 * environment (DAILY_EXPORT_PASSWORD) and never travels in the email, so a
 * leaked or forwarded email gives nobody the customer list. Without a
 * password the job refuses to run rather than send the data in the clear.
 *
 * The database copy is the live file minus two things: admin password
 * hashes (a secret, and useless outside this server) and postage-label PDFs
 * (large, and dead once the parcel has gone). The nightly server backup
 * (deploy/scripts/baclab-backup.sh) keeps the complete file for restores.
 */

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Resend takes at most 40 MB per email after base64, which adds a third.
 * Past this the database copy is left out and the email says so.
 */
export const MAX_ATTACHMENT_BYTES = 28 * 1024 * 1024;

export interface ExportConfig {
  to: string[];
  password: string;
}

/** Reads DAILY_EXPORT_TO (comma-separated) and DAILY_EXPORT_PASSWORD. */
export function exportConfig(
  env: Record<string, string | undefined> = process.env
): { ok: true; config: ExportConfig } | { ok: false; error: string } {
  const to = (env.DAILY_EXPORT_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const password = env.DAILY_EXPORT_PASSWORD ?? "";
  if (to.length === 0) return { ok: false, error: "DAILY_EXPORT_TO is not set" };
  const bad = to.find((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
  if (bad) return { ok: false, error: `DAILY_EXPORT_TO has an address that is not an email: ${bad}` };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `DAILY_EXPORT_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  return { ok: true, config: { to, password } };
}

// ── Formatting ───────────────────────────────────────────────────

const dateTimeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** UK time as "2026-11-06 14:05": sorts as text and Excel reads it as a date. */
export function ukDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  const p = Object.fromEntries(dateTimeParts.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Pounds with two decimals, as the finance export writes money. */
const money = (minor: number | null | undefined) => (minor === null || minor === undefined ? "" : (minor / 100).toFixed(2));

interface AddressJson {
  line1?: string;
  line2?: string | null;
  city?: string;
  postalCode?: string | null;
  country?: string;
}

function readAddress(json: string): AddressJson {
  if (!json) return {};
  try {
    const a: unknown = JSON.parse(json);
    return a && typeof a === "object" ? (a as AddressJson) : {};
  } catch {
    return {};
  }
}

/** One line, as a person would write it on an envelope. */
function addressText(json: string): string {
  const a = readAddress(json);
  return [a.line1, a.line2, a.city, a.postalCode, a.country].filter((s) => s && s.trim()).join(", ");
}

/** "1 × 5-pack; 1 × Welcome vial" */
function itemsText(json: string): string {
  try {
    const lines: unknown = JSON.parse(json);
    if (!Array.isArray(lines)) return "";
    return lines
      .map((l: { qty?: unknown; name?: unknown }) => `${typeof l.qty === "number" ? l.qty : "?"} × ${typeof l.name === "string" ? l.name : "item"}`)
      .join("; ");
  } catch {
    return "";
  }
}

// ── Customers ────────────────────────────────────────────────────

export interface CustomerOrder {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  status: string;
  kind: string;
  paidAt: Date | null;
  amountPaidMinor: number | null;
  items: string;
}

export interface CustomerRow {
  email: string;
  name: string;
  phone: string;
  address: string;
  firstOrderAt: Date;
  lastOrderAt: Date;
  /** Sales only: a plan's later boxes are deliveries, not orders, as in finance. */
  orders: number;
  vials: number;
  paidMinor: number;
}

/**
 * One row per email address that has paid for something, newest customer
 * activity first. Name, phone and address come from their latest order,
 * falling back to an earlier one where the latest left a field blank.
 * Cancelled and unpaid orders are not purchases and are left out.
 */
export function customerRows(orders: readonly CustomerOrder[]): CustomerRow[] {
  const paid = orders
    .filter((o): o is CustomerOrder & { paidAt: Date } => o.paidAt !== null && SOLD_STATUSES.includes(o.status) && o.customerEmail.trim() !== "")
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  const byEmail = new Map<string, CustomerRow>();
  for (const o of paid) {
    const email = normEmail(o.customerEmail);
    const kind = orderKind(o.kind);
    let row = byEmail.get(email);
    if (!row) {
      row = { email, name: "", phone: "", address: "", firstOrderAt: o.paidAt, lastOrderAt: o.paidAt, orders: 0, vials: 0, paidMinor: 0 };
      byEmail.set(email, row);
    }
    // Newest first, so the first non-blank value seen is the latest.
    row.name ||= o.customerName.trim();
    row.phone ||= o.customerPhone.trim();
    row.address ||= addressText(o.shippingAddress);
    row.firstOrderAt = o.paidAt;
    if (countsAsOrder(kind)) row.orders++;
    if (shipsParcel(kind)) row.vials += vialsOnOrder(o.items);
    if (carriesRevenue(kind)) row.paidMinor += o.amountPaidMinor ?? 0;
  }
  return [...byEmail.values()];
}

// ── Building the files ───────────────────────────────────────────

export interface ExportFile {
  name: string;
  data: string | Uint8Array;
}

export interface ExportSummary {
  customers: number;
  paidOrders: number;
  paidLast24h: number;
  subscribed: number;
  subscribers: number;
  vialsLeft: number | null;
}

async function customersAndOrders(now: Date): Promise<{ files: ExportFile[]; customers: number; paidOrders: number; paidLast24h: number }> {
  const [orders, optOuts, subscribers, shipments] = await Promise.all([
    prisma.order.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.emailOptOut.findMany({ select: { email: true } }),
    prisma.subscriber.findMany({ select: { email: true, status: true } }),
    prisma.shipment.findMany({
      where: { environment: "live", status: "CREATED" },
      select: { orderId: true, trackingNumbers: true, carrierName: true, serviceName: true },
    }),
  ]);

  const optedOut = new Set(optOuts.map((o) => normEmail(o.email)));
  const listStatus = new Map(subscribers.map((s) => [normEmail(s.email), s.status]));
  const customers = customerRows(orders);
  const customersCsv = toCsv(
    ["email", "name", "phone", "address", "first_order", "last_order", "orders", "vials", "total_paid", "mailing_list", "opted_out_of_marketing"],
    customers.map((c) => [
      c.email,
      c.name,
      c.phone,
      c.address,
      ukDateTime(c.firstOrderAt),
      ukDateTime(c.lastOrderAt),
      c.orders,
      c.vials,
      money(c.paidMinor),
      listStatus.get(c.email) ?? "",
      optedOut.has(c.email),
    ])
  );

  const labels = new Map<string, { tracking: string[]; carrier: string }>();
  for (const s of shipments) {
    let numbers: string[] = [];
    try {
      const parsed: unknown = JSON.parse(s.trackingNumbers);
      if (Array.isArray(parsed)) numbers = parsed.filter((n): n is string => typeof n === "string");
    } catch {
      // A malformed list just shows no tracking number.
    }
    const entry = labels.get(s.orderId) ?? { tracking: [], carrier: "" };
    entry.tracking.push(...numbers);
    entry.carrier ||= s.carrierName || s.serviceName;
    labels.set(s.orderId, entry);
  }

  const ordersCsv = toCsv(
    [
      "order_id", "created", "paid", "status", "kind", "payment_method",
      "customer_name", "customer_email", "customer_phone",
      "address_line_1", "address_line_2", "city", "postcode", "country",
      "items", "vials", "goods", "delivery_option", "delivery", "amount_paid",
      "carrier", "tracking_numbers", "shipped", "delivered",
      "plan_id", "plan_box", "welcome_vial", "notes",
    ],
    orders.map((o) => {
      const a = readAddress(o.shippingAddress);
      const label = labels.get(o.id);
      return [
        o.id,
        ukDateTime(o.createdAt),
        ukDateTime(o.paidAt),
        o.status,
        orderKind(o.kind),
        o.paymentMethod,
        o.customerName,
        o.customerEmail,
        o.customerPhone,
        a.line1 ?? "",
        a.line2 ?? "",
        a.city ?? "",
        a.postalCode ?? "",
        a.country ?? "",
        itemsText(o.items),
        vialsOnOrder(o.items),
        Number(o.totalAmount).toFixed(2),
        o.deliveryOption ?? "",
        money(o.deliveryMinor),
        money(o.amountPaidMinor),
        label?.carrier ?? "",
        label?.tracking.join(" ") ?? "",
        ukDateTime(o.shippedAt),
        ukDateTime(o.deliveredAt),
        o.planId ?? "",
        o.planBox ?? "",
        o.welcomeSubscriberId !== null,
        o.notes ?? "",
      ];
    })
  );

  const since = now.getTime() - 24 * 60 * 60 * 1000;
  const paid = orders.filter((o) => o.paidAt && SOLD_STATUSES.includes(o.status) && countsAsOrder(orderKind(o.kind)));
  return {
    files: [
      { name: "customers.csv", data: customersCsv },
      { name: "orders.csv", data: ordersCsv },
    ],
    customers: customers.length,
    paidOrders: paid.length,
    paidLast24h: paid.filter((o) => o.paidAt!.getTime() >= since).length,
  };
}

async function mailingList(): Promise<{ file: ExportFile; subscribed: number; total: number }> {
  const rows = await subscriberRows({ filter: "all" });
  const data = toCsv(
    ["email", "status", "source", "signed_up", "orders", "welcome_order_id", "welcome_claimed", "reminder_1", "reminder_2", "bonus_until", "unsubscribed", "duplicate_address", "consent_text"],
    rows.map((s) => [
      s.email,
      s.status,
      s.source,
      ukDateTime(s.createdAt),
      s.orderCount,
      s.welcomeOrderId ?? "",
      ukDateTime(s.welcomeClaimedAt),
      ukDateTime(s.welcomeReminder1At),
      ukDateTime(s.welcomeReminder2At),
      ukDateTime(s.welcomeBonusUntil),
      ukDateTime(s.unsubscribedAt),
      s.duplicateAddress,
      s.consentText,
    ])
  );
  return { file: { name: "mailing-list.csv", data }, subscribed: rows.filter((s) => s.status === "subscribed").length, total: rows.length };
}

async function stock(now: Date): Promise<{ files: ExportFile[]; vialsLeft: number | null }> {
  const [vials, mode, products, skus, deliveries] = await Promise.all([
    loadVialStock(now),
    getInventoryMode(),
    prisma.product.findMany({ select: { name: true, slug: true, stock: true }, orderBy: { slug: "asc" } }),
    prisma.sku.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { components: true } },
        stock: { include: { location: { include: { warehouse: true } } } },
      },
    }),
    prisma.vialDelivery.findMany({ orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }] }),
  ]);

  const rows: (string | number)[][] = [];
  if (vials.since) {
    rows.push([
      "Vial count (Admin → Stock)",
      "Vials left",
      "",
      "",
      vials.left,
      `${vials.received} booked in since ${vials.since}, ${vials.sent} sent out; about ${Math.round(vials.perDay)} a day` +
        (vials.daysLeft === null ? "" : `, roughly ${vials.daysLeft} days left`) +
        (vials.low ? ". LOW STOCK" : ""),
    ]);
  }
  for (const p of products) {
    rows.push(["Checkout counter", p.name, p.slug, "", p.stock, mode === "legacy" ? "what checkout sells against" : "not used while inventory is in warehouse mode"]);
  }
  for (const s of skus) {
    const note = [s.active ? "" : "inactive", s._count.components > 0 ? "kit, made from its parts" : ""].filter(Boolean).join("; ");
    if (s.stock.length === 0) {
      rows.push(["Warehouse stock (Admin → Inventory)", s.name, s.code, "", 0, note]);
      continue;
    }
    for (const level of s.stock) {
      const where = `${level.location.warehouse.code} / ${level.location.code}`;
      const off = !level.location.active || !level.location.warehouse.active ? "location inactive" : "";
      rows.push(["Warehouse stock (Admin → Inventory)", s.name, s.code, where, level.quantity, [note, off].filter(Boolean).join("; ")]);
    }
  }

  return {
    files: [
      { name: "stock.csv", data: toCsv(["source", "item", "code", "location", "quantity", "note"], rows) },
      {
        name: "vial-deliveries.csv",
        data: toCsv(
          ["received_on", "vials", "note", "booked_in"],
          deliveries.map((d) => [d.receivedOn, d.vials, d.note, ukDateTime(d.createdAt)])
        ),
      },
    ],
    vialsLeft: vials.since ? vials.left : null,
  };
}

async function plans(): Promise<ExportFile> {
  const all = await prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
  return {
    name: "plans.csv",
    data: toCsv(
      ["plan_id", "status", "email", "pack", "vials_per_box", "months", "boxes_sent", "next_box", "price", "paid", "paid_at", "cancelled", "refund", "purchase_order_id", "created"],
      all.map((p) => [
        p.id,
        p.status,
        p.email,
        p.packId,
        p.vialsPerBox,
        p.months,
        p.boxesSent,
        ukDateTime(p.nextBoxAt),
        money(p.totalMinor),
        money(p.paidMinor),
        ukDateTime(p.paidAt),
        ukDateTime(p.cancelledAt),
        money(p.refundMinor),
        p.purchaseOrderId,
        ukDateTime(p.createdAt),
      ])
    ),
  };
}

/**
 * A consistent copy of the live database, taken while the site keeps
 * serving (VACUUM INTO reads one snapshot; a plain file copy could catch a
 * half-written page), with the admin password hashes blanked and label
 * PDFs dropped. The final VACUUM rewrites the file so the removed bytes are
 * not left behind in free pages.
 */
async function databaseCopy(dir: string): Promise<Uint8Array> {
  const file = path.join(dir, "baclab.db");
  await prisma.$executeRaw`VACUUM INTO ${file}`;
  const copy = new PrismaClient({ datasourceUrl: `file:${file}` });
  try {
    await copy.$executeRawUnsafe(`UPDATE "AdminUser" SET "passwordHash" = ''`);
    await copy.$executeRawUnsafe(`UPDATE "Shipment" SET "label_pdf" = NULL`);
    await copy.$executeRawUnsafe("VACUUM");
  } finally {
    await copy.$disconnect();
  }
  return new Uint8Array(await readFile(file));
}

function readme(now: Date, withDatabase: boolean): string {
  return [
    `${brand.name} data export, ${ukDateTime(now)} UK time.`,
    "",
    "customers.csv        Everyone who has paid for an order: contact details from their latest order, order count, vials, total paid.",
    "orders.csv           Every order, paid or not, with address, items, amounts, carrier and tracking.",
    "mailing-list.csv     Every mailing-list sign-up, subscribed or not, with consent wording and welcome-vial status.",
    "stock.csv            The vial count (Admin → Stock), the checkout counter, and warehouse stock per SKU and location.",
    "vial-deliveries.csv  Each delivery of vials booked in on Admin → Stock.",
    "plans.csv            Monthly plans.",
    withDatabase
      ? "baclab.db            The whole database (SQLite). Open it with DB Browser for SQLite (sqlitebrowser.org).\n" +
        "                     Admin password hashes are blanked and postage-label PDFs removed; everything else is as it was."
      : "baclab.db            Left out today: the database was too large to email. The server's nightly backup has it.",
    "",
    "Money is in pounds. Times are UK time.",
    "This is personal data. Keep it somewhere private and delete old copies you no longer need.",
    "",
  ].join("\r\n");
}

export async function buildDailyExport(now: Date, opts: { database?: boolean } = {}): Promise<{ files: ExportFile[]; summary: ExportSummary }> {
  const withDatabase = opts.database ?? true;
  const [co, list, st, pl] = await Promise.all([customersAndOrders(now), mailingList(), stock(now), plans()]);
  const files: ExportFile[] = [{ name: "README.txt", data: readme(now, withDatabase) }, ...co.files, list.file, ...st.files, pl];
  if (withDatabase) {
    const dir = await mkdtemp(path.join(tmpdir(), "baclab-export-"));
    try {
      files.push({ name: "baclab.db", data: await databaseCopy(dir) });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  return {
    files,
    summary: {
      customers: co.customers,
      paidOrders: co.paidOrders,
      paidLast24h: co.paidLast24h,
      subscribed: list.subscribed,
      subscribers: list.total,
      vialsLeft: st.vialsLeft,
    },
  };
}

/** Every file into one zip, each entry AES-256 encrypted with the password. */
export async function zipExport(files: readonly ExportFile[], password: string, now: Date = new Date()): Promise<Uint8Array> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error("export password too short");
  // Node has no web workers; compress in-process.
  configure({ useWebWorkers: false });
  const writer = new ZipWriter(new Uint8ArrayWriter(), { password, encryptionStrength: 3, zipCrypto: false, lastModDate: now });
  for (const f of files) {
    await writer.add(f.name, typeof f.data === "string" ? new TextReader(f.data) : new Uint8ArrayReader(f.data));
  }
  return writer.close();
}

// ── The email ────────────────────────────────────────────────────

function sizeText(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function emailHtml(filename: string, bytes: number, s: ExportSummary, files: readonly ExportFile[], withDatabase: boolean): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#555">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`;
  return layout(
    `<p style="margin:0 0 16px">Today's export of the site's data is attached: <strong>${escapeHtml(filename)}</strong> (${sizeText(bytes)}).</p>
<p style="margin:0 0 16px">It is locked with the export password, which is set on the server as DAILY_EXPORT_PASSWORD and is never sent by email. Open it with 7-Zip (Windows), Keka or The Unarchiver (Mac). The unzip built into Windows and macOS cannot open this kind of encrypted zip.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:15px">
${row("Customers", String(s.customers))}
${row("Paid orders, all time", String(s.paidOrders))}
${row("Paid in the last 24 hours", String(s.paidLast24h))}
${row("Mailing list", `${s.subscribed} subscribed of ${s.subscribers} sign-ups`)}
${s.vialsLeft === null ? "" : row("Vials left", String(s.vialsLeft))}
</table>
<p style="margin:0 0 8px">Inside: ${files.map((f) => escapeHtml(f.name)).join(", ")}.</p>
${withDatabase ? "" : `<p style="margin:0 0 8px"><strong>The database copy was left out today because it is too large to email.</strong> The server's nightly backup still has it.</p>`}
<p style="margin:0;color:#555;font-size:13px">This holds customers' personal data. Keep it somewhere private and delete old copies you no longer need.</p>`,
    { preheader: `${s.customers} customers, ${s.paidLast24h} orders in the last 24 hours` }
  );
}

export interface DailyExportResult {
  ok: boolean;
  /** Resend's id for the email, when it was accepted. */
  emailId: string | null;
  bytes: number;
  files: string[];
  databaseIncluded: boolean;
  error?: string;
}

/** Build, encrypt and email the export. Never sends anything unencrypted. */
export async function sendDailyExport(config: ExportConfig, now: Date = new Date()): Promise<DailyExportResult> {
  let built = await buildDailyExport(now);
  let zip = await zipExport(built.files, config.password, now);
  let databaseIncluded = true;
  if (zip.length > MAX_ATTACHMENT_BYTES) {
    built = await buildDailyExport(now, { database: false });
    zip = await zipExport(built.files, config.password, now);
    databaseIncluded = false;
  }
  const files = built.files.map((f) => f.name);
  if (zip.length > MAX_ATTACHMENT_BYTES) {
    return { ok: false, emailId: null, bytes: zip.length, files, databaseIncluded, error: `export is ${sizeText(zip.length)}, too large to email even without the database` };
  }

  const day = shopDayKey(now);
  const filename = `${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-export-${day}.zip`;
  const sent = await send(config.to, `${brand.name} data export, ${formatShopDay(day)}`, emailHtml(filename, zip.length, built.summary, built.files, databaseIncluded), {
    attachments: [{ filename, content: Buffer.from(zip) }],
  });
  if (!sent?.id) {
    return { ok: false, emailId: null, bytes: zip.length, files, databaseIncluded, error: "the email was not sent (see the [email] line in the logs)" };
  }
  return { ok: true, emailId: sent.id, bytes: zip.length, files, databaseIncluded };
}
