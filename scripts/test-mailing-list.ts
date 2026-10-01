/**
 * Tests for the mailing list, the welcome vial and campaigns: the pure rules
 * in lib/mailing-list.ts and lib/campaigns.ts. Run with `npm run test:mailing`.
 * Exits non-zero on any failure, like the other tsx test scripts. Needs no
 * database: nothing here queries one.
 */
import {
  cookieFrom,
  isLinkToken,
  isWelcomeItem,
  normEmail,
  readSubscriberToken,
  signSubscriberLinkToken,
  signSubscriberToken,
  bonusActive,
  bonusDeadlineText,
  bonusOffer,
  welcomeEligible,
  welcomeItem,
  welcomeLink,
  welcomeVialCount,
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
import { reminderDue, reminderEmail } from "@/lib/welcome-reminders";
import { checkCompliance } from "@/lib/content-rules";
import { MAILING_LIST } from "@/config/funnel";

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

// ── The token in an email's link ────────────────────────────────────
const linkToken = signSubscriberLinkToken("sub_123");
check("link token names its subscriber", readSubscriberToken(linkToken) === "sub_123");
check("link token is told from a signup token", isLinkToken(linkToken) && !isLinkToken(token));
check("tampered link token is rejected", readSubscriberToken(linkToken.replace("sub_123", "sub_124")) === null);
check(
  "a link signature does not make a signup token",
  readSubscriberToken(linkToken.replace(".link.", ".")) === null
);
check(
  "a signup signature does not make a link token",
  readSubscriberToken(token.replace("sub_123.", "sub_123.link.")) === null
);
check("garbage is not a link token", !isLinkToken("nonsense") && !isLinkToken(null));
const link = new URL(welcomeLink("sub_123", "ten"));
check(
  "welcomeLink carries the token and the pack",
  link.pathname === "/api/subscribe/link" &&
    readSubscriberToken(link.searchParams.get("t")) === "sub_123" &&
    link.searchParams.get("pack") === "ten"
);
check("welcomeLink without a pack names none", !new URL(welcomeLink("sub_123")).searchParams.has("pack"));

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

// ── The second reminder's bonus ─────────────────────────────────────
const { extraVials, minVials, validDays } = MAILING_LIST.reminders.bonus;
const at = new Date("2026-10-04T12:00:00Z");
const hours = (h: number) => new Date(at.getTime() + h * 3_600_000);
const noBonus = { welcomeBonusUntil: null };
const open = { welcomeBonusUntil: hours(validDays * 24) };
check("no bonus without the second reminder", !bonusActive(noBonus, at) && welcomeVialCount(noBonus, 50, at) === 1);
check("bonus on a big enough order", welcomeVialCount(open, minVials, at) === 1 + extraVials);
check("bonus counts vials, not packs", welcomeVialCount(open, minVials + 5, at) === 1 + extraVials);
check("order under the minimum keeps the one vial", welcomeVialCount(open, minVials - 1, at) === 1);
check("bonus holds to its stated moment", welcomeVialCount(open, minVials, open.welcomeBonusUntil) === 1 + extraVials);
check(
  "bonus holds for the rest of its last day",
  welcomeVialCount(open, minVials, hours(validDays * 24 + 23)) === 1 + extraVials
);
check("bonus ends after that", welcomeVialCount(open, minVials, hours(validDays * 24 + 25)) === 1);
check(
  "the stated day is named in UK time",
  /^Sunday,? 11 October$/.test(bonusDeadlineText(new Date("2026-10-11T12:00:00Z"))),
  bonusDeadlineText(new Date("2026-10-11T12:00:00Z"))
);
check(
  "a late-evening UTC moment is named by its UK date",
  /^Sunday,? 11 October$/.test(bonusDeadlineText(new Date("2026-10-10T23:30:00Z"))),
  bonusDeadlineText(new Date("2026-10-10T23:30:00Z"))
);
check("no bonus, nothing to show", bonusOffer(noBonus, at) === null);
const shown = bonusOffer(open, at);
check(
  "an open bonus is shown with its day",
  shown?.vials === 1 + extraVials && shown.minVials === minVials && shown.by === bonusDeadlineText(open.welcomeBonusUntil)
);
check(
  "later on its last day, the day is still named",
  bonusOffer({ welcomeBonusUntil: new Date("2026-10-11T12:00:00Z") }, new Date("2026-10-11T20:00:00Z"))?.by !== null
);
const inGrace = bonusOffer({ welcomeBonusUntil: new Date("2026-10-11T12:00:00Z") }, new Date("2026-10-12T08:00:00Z"));
check("the day after, the vials still count but the day is not named", inGrace !== null && inGrace.by === null);
check("after the grace period there is nothing to show", bonusOffer(open, hours(validDays * 24 + 25)) === null);

const bonusGift = welcomeItem("p1", "baclab-10ml", 1 + extraVials);
const bonusLines = soldLines(JSON.stringify([{ ...bundleLine, qty: 10, unitPrice: "34.99", lineTotal: "34.99", bundleId: "ten" }, bonusGift]));
check(
  "bonus vials are picked as single vials",
  bonusLines[1]?.skuCode === VIAL_SKU_CODE && bonusLines[1].quantity === 1 + extraVials
);
check("bonus vials cost nothing", bonusGift.lineTotal === "0.00" && bonusLines.reduce((n, l) => n + l.lineTotalMinor, 0) === 3499);

// ── Reminders: who is due which ─────────────────────────────────────
const R = MAILING_LIST.reminders;
const rNow = new Date("2026-10-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(rNow.getTime() - h * 3_600_000);
const waiting = {
  status: "subscribed",
  welcomeOrderId: null,
  consentAt: hoursAgo(R.firstAfterHours + 1),
  welcomeReminder1At: null,
  welcomeReminder2At: null,
};
check("first reminder is due after the wait", reminderDue(waiting, rNow, true) === 1);
check("not before it", reminderDue({ ...waiting, consentAt: hoursAgo(R.firstAfterHours - 1) }, rNow, true) === null);
check("not when reminders are off", reminderDue(waiting, rNow, false) === null);
check("not to an unsubscriber", reminderDue({ ...waiting, status: "unsubscribed" }, rNow, true) === null);
check("not once the vial is used", reminderDue({ ...waiting, welcomeOrderId: "o1" }, rNow, true) === null);
check(
  "not to a signup that has gone stale",
  reminderDue({ ...waiting, consentAt: hoursAgo(R.staleAfterDays * 24 + 1) }, rNow, true) === null
);
const reminded = {
  ...waiting,
  consentAt: hoursAgo(R.firstAfterHours + R.secondAfterHours + 2),
  welcomeReminder1At: hoursAgo(R.secondAfterHours + 1),
};
check("second reminder is due after its wait", reminderDue(reminded, rNow, true) === 2);
check(
  "not before it",
  reminderDue({ ...reminded, welcomeReminder1At: hoursAgo(R.secondAfterHours - 1) }, rNow, true) === null
);
check("nothing after the second", reminderDue({ ...reminded, welcomeReminder2At: hoursAgo(1) }, rNow, true) === null);
check(
  "a fresh opt-in restarts the wait for the second",
  reminderDue({ ...reminded, consentAt: hoursAgo(1) }, rNow, true) === null
);

// ── Reminders: the emails ───────────────────────────────────────────
const text = (html: string) => html.replace(/<[^>]+>/g, " ");
const recipient = { id: "sub_123", email: "alex@example.com", welcomeBonusUntil: new Date("2026-10-11T12:00:00Z") };
for (const step of [1, 2] as const) {
  const email = reminderEmail(step, recipient);
  const violations = checkCompliance([email.subject, email.preheader, text(email.body)]);
  check(`reminder ${step} passes the house rules`, violations.length === 0, violations.map((v) => `${v.match}: ${v.why}`).join("; "));
  check(`reminder ${step} links back with the subscriber's token`, email.body.includes("/api/subscribe/link?t=sub_123.link."));
  check(`reminder ${step} can be unsubscribed from`, email.body.includes("/api/email/unsubscribe?email="));
  check(`reminder ${step} is wrapped in the shared layout`, email.html.includes(email.body) && email.html.startsWith("<!doctype html>"));
}
const second = reminderEmail(2, recipient);
check("second reminder states the deadline", /Sunday,? 11 October/.test(second.body));
check(
  "second reminder states the offer",
  second.subject.includes(String(extraVials)) && text(second.body).includes(`${1 + extraVials} free vials`) && text(second.body).includes(`${minVials} vials or more`)
);
check("first reminder promises no bonus", !/Sunday/.test(reminderEmail(1, recipient).body));

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
