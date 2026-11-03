/**
 * Test suite for lib/meta-capi-event.ts. Run with `npm run test:meta`.
 * Exits non-zero on any failure, like scripts/test-consent.ts.
 */
import { createHash } from "node:crypto";
import {
  attributionFor,
  buildPurchaseEvent,
  normaliseEmail,
  normaliseLetters,
  normalisePhone,
  normalisePostcode,
  paidMinor,
  purchaseContents,
  purchaseEventId,
  readMetaCookies,
  splitName,
  type PurchaseOrder,
} from "@/lib/meta-capi-event";
import { capiAccessToken } from "@/lib/meta-capi";
import { brandPixelChoice, brandSettingKey } from "@/lib/settings";
import { brandFor } from "@/brands/registry";
import { bacLabLeaks, registerTestBrand, TEST_BRAND_ID } from "./fixtures/test-brand";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
const ORDER_ID = "3f0c6a52-8a3e-4d7b-9d1e-2b7f0e6c1a44";

// ── Event id ───────────────────────────────────────────────────────
// The browser and the server must produce the same id, or Meta counts twice.
check("event id is stable", purchaseEventId(ORDER_ID) === purchaseEventId(ORDER_ID));
check("event id differs per order", purchaseEventId(ORDER_ID) !== purchaseEventId(`${ORDER_ID}x`));
check(
  "event id never contains the order id",
  !purchaseEventId(ORDER_ID).includes(ORDER_ID.slice(0, 8)),
  purchaseEventId(ORDER_ID)
);

// ── Value ──────────────────────────────────────────────────────────
check("value is the amount charged", paidMinor({ amountPaidMinor: 2399, totalAmount: "21.99" }) === 2399);
check("older orders fall back to goods total", paidMinor({ amountPaidMinor: null, totalAmount: "21.99" }) === 2199);

// ── Contents ───────────────────────────────────────────────────────
const items = JSON.stringify([{ bundleId: "five", bundleQty: 2, qty: 10 }]);
const contents = purchaseContents(items);
check("content id is the bundle SKU", contents[0]?.id === "baclab-10ml-x5", JSON.stringify(contents));
check("content quantity is bundles, not vials", contents[0]?.quantity === 2);
check("corrupt items yield no contents", purchaseContents("{nope").length === 0);

// ── Normalisation ──────────────────────────────────────────────────
check("email trimmed and lowercased", normaliseEmail("  Jane@Example.COM ") === "jane@example.com");
check("E.164 phone loses the plus", normalisePhone("+44 7700 900123", "GB") === "447700900123");
check("national UK phone gains 44", normalisePhone("07700 900123", "GB") === "447700900123");
check("00-prefixed phone loses 00", normalisePhone("0044 7700 900123", "FR") === "447700900123");
check("empty phone stays empty", normalisePhone("", "GB") === "");
check("names lose punctuation and spaces", normaliseLetters(" O'Brien-Smith ") === "obriensmith");
check("accented letters survive", normaliseLetters("Zoë") === "zoë");
check("towns lose spaces", normaliseLetters("Milton Keynes") === "miltonkeynes");
check("postcodes lose spaces", normalisePostcode("SW1A 1AA") === "sw1a1aa");
check("first and last name split", JSON.stringify(splitName("Jane Q Doe")) === '{"first":"Jane","last":"Doe"}');
check("single name has no last name", splitName("Cher").last === "");

// ── Cookies ────────────────────────────────────────────────────────
const cookies = readMetaCookies(
  "theme=dark; _fbp=fb.1.1789466400000.1234567890; _fbc=fb.1.1789466400000.IwAR3x_y-Z"
);
check("reads _fbp", cookies.fbp === "fb.1.1789466400000.1234567890");
check("reads _fbc", cookies.fbc === "fb.1.1789466400000.IwAR3x_y-Z");
check("rejects a malformed _fbp", readMetaCookies("_fbp=<script>").fbp === null);
check("no cookie header is fine", readMetaCookies(null).fbp === null);

// ── Attribution at checkout ────────────────────────────────────────
const request = {
  cookie: "_fbp=fb.1.1789466400000.1234567890",
  userAgent: "Mozilla/5.0",
  ip: "203.0.113.7",
};
const refused = attributionFor(false, request);
check(
  "without consent nothing is stored",
  !refused.trackingConsent && !refused.clientIp && !refused.clientUserAgent && !refused.fbp && !refused.fbc
);
const granted = attributionFor(true, request);
check("with consent the IP is stored", granted.clientIp === "203.0.113.7");
check("with consent the cookie is stored", granted.fbp === "fb.1.1789466400000.1234567890");
check("a non-IP is not stored", attributionFor(true, { ...request, ip: "unknown" }).clientIp === null);

// ── The event ──────────────────────────────────────────────────────
const order: PurchaseOrder = {
  id: ORDER_ID,
  items,
  totalAmount: "43.98",
  amountPaidMinor: 4398,
  customerName: "Jane Doe",
  customerEmail: "Jane@Example.com",
  customerPhone: "+447700900123",
  shippingAddress: JSON.stringify({ city: "Milton Keynes", country: "GB", postalCode: "MK9 1AA" }),
  ...granted,
};
const opts = { eventTime: 1789466400, eventSourceUrl: "https://baclab.co.uk/order-confirmation" };
const event = buildPurchaseEvent(order, opts);

check("no event without consent", buildPurchaseEvent({ ...order, ...refused }, opts) === null);
check("no event without a user agent", buildPurchaseEvent({ ...order, clientUserAgent: null }, opts) === null);
check("event is built with consent", event !== null);
if (event) {
  check("event name is Purchase", event.event_name === "Purchase");
  check("event id matches the browser's", event.event_id === purchaseEventId(ORDER_ID));
  check("action source is website", event.action_source === "website");
  check("value is in pounds", event.custom_data.value === 43.98);
  check("currency is GBP", event.custom_data.currency === "GBP");
  check("email is hashed after normalising", event.user_data.em === sha256("jane@example.com"));
  check("phone is hashed after normalising", event.user_data.ph === sha256("447700900123"));
  check("postcode is hashed after normalising", event.user_data.zp === sha256("mk91aa"));
  check("country is hashed lowercase", event.user_data.country === sha256("gb"));
  check("IP is sent unhashed", event.user_data.client_ip_address === "203.0.113.7");
  check("fbp is sent unhashed", event.user_data.fbp === "fb.1.1789466400000.1234567890");
  check("no raw email anywhere", !JSON.stringify(event).toLowerCase().includes("jane@example.com"));
  check("no order id anywhere", !JSON.stringify(event).includes(ORDER_ID));
  check("absent fbc is omitted", !("fbc" in event.user_data));
}
const noContact = buildPurchaseEvent(
  { ...order, customerEmail: "", customerPhone: "", customerName: "", shippingAddress: "" },
  opts
);
check("blank contact fields are omitted, not hashed", noContact !== null && !("em" in noContact.user_data) && !("ph" in noContact.user_data));

// ── A second brand ─────────────────────────────────────────────────
// Its own content ids, token and pixel; never BacLab's catalogue or dataset.
const fx = registerTestBrand();
check("baclab ids are unchanged without a brand", purchaseContents(items)[0]?.id === "baclab-10ml-x5");
check("baclab ids are unchanged with it", purchaseContents(items, "baclab")[0]?.id === "baclab-10ml-x5");
const fxItems = JSON.stringify([
  { sku: "FX-10ML-X5", bundleId: "five", bundleQty: 2, qty: 10 },
  { bundleId: "fx-trio", qty: 3 },
  { qty: 1, welcome: true },
  { qty: 1, gift: true },
]);
const fxContents = purchaseContents(fxItems, TEST_BRAND_ID);
check("a line's own SKU is its content id", fxContents[0]?.id === "FX-10ML-X5" && fxContents[0]?.quantity === 2, JSON.stringify(fxContents));
check("a line without a SKU keeps its bundle id", fxContents[1]?.id === "fx-trio");
check("a bare line is the neutral vial", fxContents[2]?.id === "vial-10ml");
check("gifts are still left out", fxContents.length === 3);
check("no BacLab SKU in another brand's ids", fxContents.every((c) => bacLabLeaks(c.id).length === 0), JSON.stringify(fxContents));
const fxEvent = buildPurchaseEvent({ ...order, brand: TEST_BRAND_ID, items: fxItems }, { ...opts, eventSourceUrl: `${fx.origin}/order-confirmation` });
check("the event carries the brand's ids", JSON.stringify(fxEvent?.custom_data.content_ids) === JSON.stringify(["FX-10ML-X5", "fx-trio", "vial-10ml"]));
check("the event id is the same rule for every brand", fxEvent?.event_id === purchaseEventId(ORDER_ID));

const env = process.env as Record<string, string | undefined>;
const saved = { shared: env.META_CAPI_ACCESS_TOKEN, own: env.META_CAPI_ACCESS_TOKEN__TESTBRAND, baclab: env.META_CAPI_ACCESS_TOKEN__BACLAB };
env.META_CAPI_ACCESS_TOKEN = "shared-token";
delete env.META_CAPI_ACCESS_TOKEN__TESTBRAND;
delete env.META_CAPI_ACCESS_TOKEN__BACLAB;
check("baclab uses the shared token", capiAccessToken(brandFor("baclab")) === "shared-token");
check("a brand without its own token falls back to the shared one", capiAccessToken(fx) === "shared-token");
env.META_CAPI_ACCESS_TOKEN__TESTBRAND = "  own-token ";
check("a brand's own token wins", capiAccessToken(fx) === "own-token");
check("…and is not BacLab's", capiAccessToken(brandFor("baclab")) === "shared-token");
delete env.META_CAPI_ACCESS_TOKEN;
delete env.META_CAPI_ACCESS_TOKEN__TESTBRAND;
check("no token at all sends nothing", capiAccessToken(fx) === undefined);
for (const [key, value] of [
  ["META_CAPI_ACCESS_TOKEN", saved.shared],
  ["META_CAPI_ACCESS_TOKEN__TESTBRAND", saved.own],
  ["META_CAPI_ACCESS_TOKEN__BACLAB", saved.baclab],
] as const) {
  if (value === undefined) delete env[key];
  else env[key] = value;
}

check("pixel: a saved brand setting wins", brandPixelChoice("111111111111111", "999999999999999") === "111111111111111");
check("pixel: a saved empty setting is off", brandPixelChoice("", "999999999999999") === null);
check("pixel: then the brand's profile", brandPixelChoice(null, fx.analytics?.metaPixelId) === "999999999999999");
check("pixel: a malformed saved id is passed over", brandPixelChoice("abc", "999999999999999") === "999999999999999");
check("pixel: nothing set goes on to the next source", brandPixelChoice(null, undefined) === undefined);
check("pixel setting key is per brand", brandSettingKey("meta_pixel_id", TEST_BRAND_ID) === "meta_pixel_id:testbrand");

if (failures > 0) {
  console.error(`\n${failures} Meta CAPI check(s) failed.`);
  process.exit(1);
}
console.log("✓ Meta CAPI rules pass");
