/**
 * Test suite for the contact form: ContactSchema (lib/validation.ts), the
 * topics (lib/contact.ts) and the inbox alert (lib/contact-inbox.ts). Run
 * with `npm run test:contact`. Exits non-zero on any failure, like
 * scripts/test-sale.ts. Touches no database and sends no email.
 */
import { CONTACT_MESSAGE_MAX, CONTACT_TOPICS, contactTopic } from "@/lib/contact";
import { buildContactAlert, normaliseOrderRef } from "@/lib/contact-inbox";
import { checkCompliance } from "@/lib/content-rules";
import { ContactSchema } from "@/lib/validation";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

// ── ContactSchema ─────────────────────────────────────────────────────────
const valid = {
  topic: "delivery",
  name: "Jane Doe",
  email: "jane@example.com",
  orderRef: "1A2B3C4D",
  message: "My parcel has not arrived yet.",
};
const ok = (v: unknown) => ContactSchema.safeParse(v).success;

check("a complete message passes", ok(valid));
check("order number may be left out", ok({ ...valid, orderRef: undefined }));
check("order number may be blank", ok({ ...valid, orderRef: "" }));
check("every topic id is accepted", CONTACT_TOPICS.every((t) => ok({ ...valid, topic: t.id })));
check("an unknown topic is refused", !ok({ ...valid, topic: "refund-now" }));
check("a missing topic is refused", !ok({ ...valid, topic: "" }));
check("a bad email is refused", !ok({ ...valid, email: "jane@" }));
check("a one-letter name is refused", !ok({ ...valid, name: "J" }));
check("a near-empty message is refused", !ok({ ...valid, message: "help" }));
check("a whitespace-padded short message is refused", !ok({ ...valid, message: "   help      " }));
check("the longest message passes", ok({ ...valid, message: "x".repeat(CONTACT_MESSAGE_MAX) }));
check("a longer one is refused", !ok({ ...valid, message: "x".repeat(CONTACT_MESSAGE_MAX + 1) }));
check("unknown keys are refused (strict)", !ok({ ...valid, phone: "0123" }));
check("the honeypot key is allowed", ok({ ...valid, website: "spam.example" }));

// ── Topics ────────────────────────────────────────────────────────────────
check("topic ids are unique", new Set(CONTACT_TOPICS.map((t) => t.id)).size === CONTACT_TOPICS.length);
check("contactTopic finds a topic", contactTopic("complaint")?.label === "Complaint");
check("contactTopic misses cleanly", contactTopic("nope") === undefined);
check("complaints ask for the order", contactTopic("complaint")?.asksOrder === true);
check("wholesale does not ask for an order", contactTopic("wholesale")?.asksOrder === false);
{
  const copy = CONTACT_TOPICS.flatMap((t) => [t.label, "hint" in t ? t.hint : ""]).filter(Boolean);
  const violations = checkCompliance(copy);
  check(
    "topic copy passes the content rules",
    violations.length === 0,
    violations.map((v) => v.why).join("; ")
  );
}

// ── Order references ──────────────────────────────────────────────────────
const uuid = "3f2b8c1e-9d4a-4e6b-8a7c-1b2c3d4e5f60";
check("a full order id is kept", normaliseOrderRef(uuid) === uuid);
check("an upper-case id is lowered", normaliseOrderRef(uuid.toUpperCase()) === uuid);
check("the 8-character label reference works", normaliseOrderRef("3F2B8C1E") === "3f2b8c1e");
check("a leading # and spaces are dropped", normaliseOrderRef(" #3f2b 8c1e ") === "3f2b8c1e");
check("too short to be one is refused", normaliseOrderRef("3f2b") === null);
check("words are refused", normaliseOrderRef("my order from Monday") === null);
check("blank is refused", normaliseOrderRef("") === null);

// ── The inbox alert ───────────────────────────────────────────────────────
const msg = {
  id: "cm_test",
  topic: "complaint",
  name: "Jane <b>Doe</b>",
  email: "jane@example.com",
  orderRef: "3F2B8C1E",
  message: 'Line one <script>alert("x")</script>\nLine two',
  createdAt: new Date("2026-10-12T09:30:00Z"),
};
{
  const { subject, html } = buildContactAlert(msg, null);
  check("subject names the topic", subject.includes("Complaint"));
  check("subject names the sender", subject.includes("Jane"));
  check("the message is escaped", !html.includes("<script>") && html.includes("&lt;script&gt;"));
  check("the name is escaped", !html.includes("<b>Doe</b>") && html.includes("&lt;b&gt;Doe&lt;/b&gt;"));
  check("line breaks survive", html.includes("Line one") && /&lt;\/script&gt;<br>Line two/.test(html));
  check("an unmatched order says so", html.includes("no order matches this"));
  check("it links to the message in admin", html.includes("/admin/messages/cm_test"));
  check("it says who a reply goes to", html.includes("it goes to jane@example.com"));
}
{
  const { html } = buildContactAlert(msg, uuid);
  check("a matched order links to it", html.includes(`/admin/orders/${uuid}`));
  check("a matched order is not called unmatched", !html.includes("no order matches this"));
}
{
  const { html } = buildContactAlert({ ...msg, orderRef: "" }, null);
  check("no order given says so", html.includes("Not given"));
}

if (failures > 0) {
  console.error(`\n${failures} contact check(s) failed.`);
  process.exit(1);
}
console.log("All contact checks passed.");
