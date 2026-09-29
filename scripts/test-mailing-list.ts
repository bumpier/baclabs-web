/**
 * Tests for the mailing list, the welcome vial and campaigns: the pure rules
 * in lib/mailing-list.ts and lib/campaigns.ts. Run with `npm run test:mailing`.
 * Exits non-zero on any failure, like the other tsx test scripts. Needs no
 * database: nothing here queries one.
 */
import {
  cookieFrom,
  isWelcomeItem,
  normEmail,
  readSubscriberToken,
  signSubscriberToken,
  welcomeEligible,
  welcomeItem,
  addressKey,
} from "@/lib/mailing-list";
import {
  applyMergeFields,
  markdownToEmailHtml,
  mergeAudience,
  parseAudience,
  EMPTY_AUDIENCE,
  renderSubject,
} from "@/lib/campaigns";
import { soldLines, VIAL_SKU_CODE } from "@/lib/inventory/demand";
import { unsubscribeSig } from "@/lib/customer-email";

process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters-long";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

// ── Emails ──────────────────────────────────────────────────────────
check("normEmail lower-cases and trims", normEmail("  Alex@Example.COM ") === "alex@example.com");

// ── Signed cookie ───────────────────────────────────────────────────
const token = signSubscriberToken("sub_123");
check("token round-trips", readSubscriberToken(token) === "sub_123");
check("tampered id is rejected", readSubscriberToken(token.replace("sub_123", "sub_124")) === null);
check("tampered signature is rejected", readSubscriberToken(token.slice(0, -2) + "00") === null);
check("garbage is rejected", readSubscriberToken("nonsense") === null);
check("empty is rejected", readSubscriberToken(undefined) === null);
check(
  "an unsubscribe signature is not a subscriber token",
  readSubscriberToken(`sub_123.${unsubscribeSig("sub_123")}`) === null
);
check("cookieFrom finds the cookie", cookieFrom(`a=1; bl_sub=${encodeURIComponent(token)}; b=2`, "bl_sub") === token);
check("cookieFrom misses cleanly", cookieFrom("a=1", "bl_sub") === null && cookieFrom(null, "bl_sub") === null);

// ── Eligibility ─────────────────────────────────────────────────────
const fresh = { status: "subscribed", welcomeOrderId: null };
check("fresh subscriber, no orders: eligible", welcomeEligible(fresh, 0, true));
check("has ordered before: not eligible", !welcomeEligible(fresh, 1, true));
check("gift already claimed: not eligible", !welcomeEligible({ ...fresh, welcomeOrderId: "o1" }, 0, true));
check("unsubscribed: not eligible", !welcomeEligible({ ...fresh, status: "unsubscribed" }, 0, true));
check("offer switched off: not eligible", !welcomeEligible(fresh, 0, false));
check("no subscriber: not eligible", !welcomeEligible(null, 0, true));

// ── The order line reaches the warehouse as a vial, at £0 ───────────
const bundleLine = {
  productId: "p1",
  slug: "baclab-10ml",
  name: "Bacteriostatic Water 10ml vial",
  qty: 5,
  unitPrice: "21.99",
  lineTotal: "21.99",
  bundleId: "five",
  bundleName: "5-vial pack",
  bundleQty: 1,
};
const gift = welcomeItem("p1", "baclab-10ml");
check("welcome line is flagged", isWelcomeItem(gift) && !isWelcomeItem(bundleLine));
check("welcome line costs nothing", gift.lineTotal === "0.00" && gift.unitPrice === "0.00" && gift.qty === 1);
const lines = soldLines(JSON.stringify([bundleLine, gift]));
const giftLine = lines[1];
check("welcome line is picked as the single vial", giftLine?.skuCode === VIAL_SKU_CODE && giftLine.quantity === 1);
check(
  "line totals still add up to the charge",
  lines.reduce((n, l) => n + l.lineTotalMinor, 0) === 2199,
  String(lines.map((l) => l.lineTotalMinor))
);

// ── Repeat-address key ──────────────────────────────────────────────
const a1 = JSON.stringify({ line1: "12 High St", postalCode: "SW1A 1AA" });
const a2 = JSON.stringify({ line1: "12 high st.", postalCode: "sw1a1aa" });
check("same address, different spelling, same key", addressKey(a1) === addressKey(a2));
check("unreadable address has no key", addressKey("not json") === null);

// ── Audiences ───────────────────────────────────────────────────────
const now = new Date("2026-09-29T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const subscribers = [{ email: "Sub@One.com" }, { email: "buyer@two.com" }, { email: "gone@four.com" }];
const customers = [
  { email: "buyer@two.com", name: "Sam Smith", lastOrderAt: daysAgo(10) },
  { email: "old@three.com", name: "Old Customer", lastOrderAt: daysAgo(200) },
];
const optedOut = new Set(["gone@four.com"]);
const emails = (spec: Partial<typeof EMPTY_AUDIENCE>) =>
  mergeAudience({ ...EMPTY_AUDIENCE, ...spec }, subscribers, customers, optedOut, now)
    .map((r) => r.email)
    .sort()
    .join(",");

check("all subscribers, minus opt-outs, lower-cased", emails({ subscribers: true }) === "buyer@two.com,sub@one.com");
check("subscribers not ordered", emails({ subscribersNotOrdered: true }) === "sub@one.com");
check("all customers", emails({ customers: true }) === "buyer@two.com,old@three.com");
check("lapsed customers", emails({ lapsedCustomers: true, lapsedDays: 90 }) === "old@three.com");
check(
  "union has no duplicates",
  emails({ subscribers: true, customers: true }) === "buyer@two.com,old@three.com,sub@one.com"
);
check("empty audience is empty", emails({}) === "");
const named = mergeAudience({ ...EMPTY_AUDIENCE, customers: true }, [], customers, new Set(), now);
check("first name comes from the latest order", named.find((r) => r.email === "buyer@two.com")?.firstName === "Sam");
check("parseAudience survives junk", parseAudience("not json").subscribers === false);
check("parseAudience keeps a sane day count", parseAudience('{"lapsedDays":-5}').lapsedDays === 90);

// ── Rendering ───────────────────────────────────────────────────────
const html = markdownToEmailHtml(
  "# Hello\n\nA **bold** and *soft* line with a [link](https://baclab.co.uk).\n\n- one\n- two\n\n[button: Shop](https://baclab.co.uk/#buy)\n\n<script>alert(1)</script> [bad](javascript:alert(1))"
);
check("heading renders", html.includes("<h2") && html.includes("Hello"));
check("bold and italic render", html.includes("<strong>bold</strong>") && html.includes("<em>soft</em>"));
check("links render", html.includes('href="https://baclab.co.uk"'));
check("lists render", html.includes("<ul") && html.includes("<li"));
check("button renders", html.includes("https://baclab.co.uk/#buy") && html.includes("Shop"));
check("raw HTML is escaped", !html.includes("<script>") && html.includes("&lt;script&gt;"));
check("javascript: links are neutralised", !html.includes("javascript:"));

const merged = applyMergeFields("<p>Hi {{first_name}}, use {{ code }}</p>", {
  firstName: "<b>Eve</b>",
  code: "SAVE10",
  offer: "",
  expires: "",
});
check("merge fields fill in", merged.includes("SAVE10"));
check("merge values are escaped", merged.includes("&lt;b&gt;Eve&lt;/b&gt;") && !merged.includes("<b>Eve"));
check(
  "missing first name reads 'there'",
  applyMergeFields("Hi {{first_name}}", { firstName: "", code: "", offer: "", expires: "" }) === "Hi there"
);
check("subject merge", renderSubject({ subject: "For you, {{first_name}}" }, { email: "x", firstName: "Jo" }) === "For you, Jo");

if (failures > 0) {
  console.error(`\n${failures} mailing-list check(s) failed`);
  process.exit(1);
}
console.log("mailing list: all checks passed");
