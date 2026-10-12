/**
 * Tests for free vials promised by email (lib/vial-gifts.ts): the order line,
 * expiry and status, the email, and every reader of Order.items that has to
 * tell a free line from a paid one. Run with `npm run test:gifts`. Exits
 * non-zero on any failure, like the other tsx test scripts. Needs no
 * database; scripts/smoke-vial-gifts.ts covers fulfilment against one.
 */
import {
  GIFT_EXPIRY_DAYS,
  giftEmail,
  giftExpiresAt,
  giftItem,
  giftStatus,
  isGiftItem,
  lastGiftDay,
} from "@/lib/vial-gifts";
import { isWelcomeItem, welcomeItem } from "@/lib/mailing-list";
import { soldLines, VIAL_SKU_CODE } from "@/lib/inventory/demand";
import { reorderOffer } from "@/lib/reorder";
import { planPackOf, upgradeEligibility } from "@/lib/plans/upgrade";
import { ledgerRow, packOf, summarise, type LedgerContext, type LedgerOrder } from "@/lib/finance/ledger";
import { purchaseContents } from "@/lib/meta-capi-event";
import { buildOrderItems } from "@/lib/order-items";
import { bundleById, priceOrder } from "@/config/funnel";
import { checkCompliance } from "@/lib/content-rules";
import { shopDayKey } from "@/lib/saleTime";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const DAY = 86_400_000;
const ten = bundleById("ten")!;
const tenPack = buildOrderItems({
  productId: "p1",
  slug: "baclab-10ml",
  bundle: ten,
  quantity: 1,
  priced: priceOrder(ten, 1)!,
  goodsUsd: "1.00",
});
const gift = giftItem("p1", "baclab-10ml", 3);

// ── The order line ──────────────────────────────────────────────────
check("gift line is flagged as a gift, not a welcome vial", isGiftItem(gift) && !isWelcomeItem(gift));
check("welcome and pack lines are not gifts", !isGiftItem(welcomeItem("p1", "baclab-10ml")) && !isGiftItem(tenPack[0]!));
check("gift line costs nothing", gift.unitPrice === "0.00" && gift.lineTotal === "0.00" && gift.qty === 3);
check("gift line has no bundle", gift.bundleId === undefined);
check("one vial reads singular", giftItem("p1", "s", 1).name === "Free vial, with our apologies");
check("several read plural", gift.name === "Free vials, with our apologies");
const sold = soldLines(JSON.stringify([...tenPack, gift]));
check(
  "gift is picked as the single vial, 3 of them",
  sold.at(-1)?.skuCode === VIAL_SKU_CODE && sold.at(-1)?.quantity === 3,
  JSON.stringify(sold.at(-1))
);
check(
  "line totals still add up to the charge",
  sold.reduce((n, l) => n + l.lineTotalMinor, 0) === priceOrder(ten, 1)!.goodsMinor
);

// ── Expiry and status ───────────────────────────────────────────────
const added = new Date("2026-10-12T15:30:00Z"); // 16:30 UK, BST
const expires = giftExpiresAt(added);
check(`last day is ${GIFT_EXPIRY_DAYS} UK days on`, lastGiftDay(expires) === "2027-01-10", lastGiftDay(expires));
check("it expires at UK midnight after that day (GMT by then)", expires.toISOString() === "2027-01-11T00:00:00.000Z", expires.toISOString());
const added2 = new Date("2026-10-12T23:30:00Z"); // 00:30 on 13 Oct, UK
check("added just after UK midnight counts from the UK day", lastGiftDay(giftExpiresAt(added2)) === "2027-01-11");
const row = { orderId: null, cancelledAt: null, expiresAt: expires };
check("new gift is waiting", giftStatus(row, added) === "waiting");
check("still waiting a moment before it expires", giftStatus(row, new Date(expires.getTime() - 1)) === "waiting");
check("expired at the boundary", giftStatus(row, expires) === "expired");
check("used beats expired", giftStatus({ ...row, orderId: "o1" }, new Date(expires.getTime() + DAY)) === "used");
check("cancelled", giftStatus({ ...row, cancelledAt: added }, added) === "cancelled");
check("the expiry day falls on the UK calendar", shopDayKey(new Date(expires.getTime() - 1)) === "2027-01-10");

// ── The email ───────────────────────────────────────────────────────
const email = giftEmail({ vials: 3, expiresAt: expires }, "Sam");
check("subject names the vials", email.subject.startsWith("3 free vials on your next "), email.subject);
check("greets by first name", email.html.includes("Hi Sam,"));
check("says how many", email.html.includes("3 free 10ml vials"));
check("names the last day", email.html.includes("Sunday 10 January 2027"));
const one = giftEmail({ vials: 1, expiresAt: expires });
check("one vial reads singular", one.subject.startsWith("A free vial on your next") && one.html.includes("a free 10ml vial"), one.subject);
check("no name: Hi there", one.html.includes("Hi there,"));
check("a name is escaped", giftEmail({ vials: 2, expiresAt: expires }, "<b>").html.includes("Hi &lt;b&gt;,"));
// The words only: the shared layout's <!doctype> would trip the "!" rule.
const violations = checkCompliance([email.subject, email.html.replace(/<[^>]*>/g, " ")]);
check("copy passes the content rules", violations.length === 0, JSON.stringify(violations));

// ── Readers of Order.items ignore the free line ─────────────────────
const withGift = JSON.stringify([...tenPack, gift]);
const offer = reorderOffer(withGift);
check("reorder offers the pack, not the gift", offer?.bundle.id === "ten" && offer.quantity === 1 && offer.extraVials === 0);

check("plan pack skips the gift", planPackOf(JSON.stringify([gift, { qty: 10, bundleId: "ten", bundleQty: 1 }])) === "ten");
const now = new Date("2026-10-08T12:00:00Z");
const verdict = upgradeEligibility(
  {
    kind: "sale",
    status: "paid",
    planId: null,
    paidAt: new Date(now.getTime() - 2 * DAY),
    items: JSON.stringify([{ qty: 10, bundleId: "ten", bundleQty: 1 }, { qty: 1, welcome: true }, { qty: 3, gift: true }]),
  },
  now
);
check("a gift does not count as a second pack for the plan upgrade", verdict.eligible, JSON.stringify(verdict));

check("finance pack skips a gift listed first", packOf([{ qty: 3, gift: true }, { qty: 10, bundleId: "ten" }]) === "ten");
const order = (items: unknown[]): LedgerOrder => ({
  id: "o1",
  kind: "sale",
  status: "paid",
  customerName: "A",
  customerEmail: "a@example.com",
  items: JSON.stringify(items),
  amountPaidMinor: 3499,
  totalAmount: "34.99",
  deliveryMinor: 0,
  deliveryOption: "standard",
  paidAt: new Date("2026-10-06T08:55:00Z"),
  createdAt: new Date("2026-10-06T08:50:00Z"),
  shipments: [],
});
const ctx: LedgerContext = { rates: [], vatFrom: null, firstOrderByEmail: new Map() };
const ledger = ledgerRow(order([{ qty: 10, bundleId: "ten" }, { qty: 1, welcome: true }, { qty: 3, gift: true }]), ctx);
check(
  "finance counts gift vials as vials and on their own",
  ledger.vials === 14 && ledger.welcomeVials === 1 && ledger.giftVials === 3 && ledger.pack === "ten",
  JSON.stringify({ v: ledger.vials, w: ledger.welcomeVials, g: ledger.giftVials, p: ledger.pack })
);
check("finance totals add up gift vials", summarise([ledger, ledger]).giftVials === 6);

const contents = purchaseContents(withGift);
check(
  "Meta purchase contents leave the gift out",
  contents.length === tenPack.length && contents.every((c) => c.id !== "baclab-10ml" || c.quantity === 1),
  JSON.stringify(contents)
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("vial gifts: all checks passed");
