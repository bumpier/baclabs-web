/**
 * PayPal for the brands (lib/commerce/payments/paypal.ts, paypal-settle.ts),
 * with PayPal faked: every fetch is answered by scripts/fixtures/fake-paypal.ts
 * and anything not addressed to PayPal's API hosts throws, so no request
 * leaves the process. Run with `npm run test:paypal`. No database: the
 * checkout, return and webhook against real rows are in test:brand-checkout's
 * opt-in database checks.
 *
 * No brand takes PayPal today: all four are on Stripe. PayPal stays built
 * so a brand can move to it by its profile and its own PAYPAL_*__<ID>, so
 * these checks run on test brands that list it (registerPayPalTestBrand),
 * one made from each real brand, and check that moving a real brand takes
 * nothing more than that.
 */
import { clearPayPalEnv, fakePayPal, json, paypalOrderJson, setPayPalEnv, webhookHeaders, type PayPalCall } from "./fixtures/fake-paypal";
import { registerPayPalTestBrand } from "./fixtures/test-brand";
import { PAYPAL_PAYMENT } from "@/brands/payment-methods";
import { brandFor, BRAND_IDS, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import type { BrandId } from "@/brands/types";
import { checkBrandCopy, checkCompliance } from "@/lib/content-rules";
import { priceBrandLines } from "@/lib/commerce/pricing";
import { catalogueDeliveryOptions } from "@/lib/commerce/catalogue";
import { brandPaymentAdapters, type PaymentOrder } from "@/lib/commerce/payments";
import {
  __clearPayPalTokens,
  capturePayPalOrder,
  certEnvironment,
  eventRefs,
  paypalAdapter,
  paypalCredentials,
  paypalOrderBody,
  readPayPalOrder,
  SOFT_DESCRIPTOR_MAX,
  verifyPayPalWebhook,
  type PayPalEvent,
} from "@/lib/commerce/payments/paypal";
import { amountMismatch, handlePayPalWebhook, returnRedirect } from "@/lib/commerce/payments/paypal-settle";
import { storefrontView } from "@/lib/commerce/storefront";
import { paymentReturnMessage } from "@/lib/commerce/view";
import { returnedFromPayment } from "@/lib/commerce/order-view";
import { abandonedVerdict, type PayPalOrderState } from "@/lib/payments/abandoned";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const REAL_BRANDS = BRAND_IDS.filter((id) => id !== DEFAULT_BRAND).map((id) => brandFor(id));
/** A PayPal test brand per real brand but the gym, which never goes on PayPal: fixture id -> the brand it is made from. */
const SOURCE = new Map<string, string>([
  ["ppbea", "beauty"],
  ["ppwho", "wholesale"],
  ["pplux", "luxury"],
]);
const PAYPAL_BRANDS = [...SOURCE].map(([id, from]) => registerPayPalTestBrand(brandFor(from), id));
const ORDER_ID = "5f1c2e1a-0000-4000-8000-000000000001";

function paymentOrder(b: BrandProfile, lines: { sku: string; qty: number }[], deliveryIndex = 0): PaymentOrder {
  const r = priceBrandLines(b.catalogue!, lines, { labKitOnSale: true });
  if (!r.ok) throw new Error(r.error);
  const d = catalogueDeliveryOptions(b.catalogue!, r.order.goodsMinor)[deliveryIndex]!;
  return { id: ORDER_ID, lines: r.order.lines, goodsMinor: r.order.goodsMinor, delivery: { id: d.option.id, label: d.option.label, priceMinor: d.priceMinor } };
}

async function main() {
  const paypal = fakePayPal();
  clearPayPalEnv();

  // ── Which brands: listed on the profile ─────────────────────────────
  check("no real brand lists PayPal: all four are on Stripe", REAL_BRANDS.every((b) => (b.paymentProviders ?? []).join() === "stripe"), REAL_BRANDS.map((b) => `${b.id}:${b.paymentProviders}`).join(" "));
  check("BacLab lists none", (brandFor(DEFAULT_BRAND).paymentProviders ?? []).length === 0);
  check("the test brands list PayPal, in PayPal's words", PAYPAL_BRANDS.every((b) => (b.paymentProviders ?? []).join() === "paypal" && b.payment === PAYPAL_PAYMENT));

  // ── Credentials: the brand's own, all four, no fallback ─────────────
  // Fixture ids are not BrandIds: compared as plain strings.
  const lux = PAYPAL_BRANDS.find((b) => (b.id as string) === "pplux")!;
  const bea = PAYPAL_BRANDS.find((b) => (b.id as string) === "ppbea")!;
  const LUX = lux.id.toUpperCase();
  check("no credentials: not configured", paypalCredentials(lux.id) === null && !paypalAdapter.configured(lux));
  for (const k of ["CLIENT_ID", "CLIENT_SECRET", "WEBHOOK_ID", "ENV"]) process.env[`PAYPAL_${k}`] = k === "ENV" ? "sandbox" : "shared";
  check("no fallback: unsuffixed PAYPAL_* is never read", paypalCredentials(lux.id) === null);
  setPayPalEnv(bea.id);
  check("no fallback: another brand's credentials are never lent", paypalCredentials(lux.id) === null && paypalCredentials(bea.id) !== null);
  setPayPalEnv(lux.id);
  delete process.env[`PAYPAL_ENV__${LUX}`];
  check("PAYPAL_ENV__<ID> is required: no default environment", paypalCredentials(lux.id) === null);
  process.env[`PAYPAL_ENV__${LUX}`] = "production";
  check("PAYPAL_ENV__<ID> is sandbox or live only", paypalCredentials(lux.id) === null);
  process.env[`PAYPAL_ENV__${LUX}`] = "live";
  check("all four set: configured, live", paypalCredentials(lux.id)?.apiBase === "https://api-m.paypal.com");
  process.env[`PAYPAL_ENV__${LUX}`] = "sandbox";
  check("sandbox talks to the sandbox", paypalCredentials(lux.id)?.apiBase === "https://api-m.sandbox.paypal.com");
  for (const k of ["CLIENT_ID", "CLIENT_SECRET", "WEBHOOK_ID"]) {
    const saved = process.env[`PAYPAL_${k}__${LUX}`];
    delete process.env[`PAYPAL_${k}__${LUX}`];
    check(`PAYPAL_${k}__<ID> is required`, paypalCredentials(lux.id) === null);
    process.env[`PAYPAL_${k}__${LUX}`] = saved;
  }
  setPayPalEnv("baclab");
  check("BacLab never has PayPal credentials, even if set", paypalCredentials(DEFAULT_BRAND) === null);

  // The real brands: PayPal credentials set on purpose, still no PayPal,
  // because none lists it. With BacLab's Stripe off here, none takes
  // payment at all, and PayPal is never called.
  for (const b of REAL_BRANDS) setPayPalEnv(b.id);
  const callsBefore = paypal.calls.length;
  const { brandCheckout, CHECKOUT_UNAVAILABLE } = await import("@/lib/commerce/checkout");
  const post = (b: BrandProfile, body: unknown) =>
    brandCheckout(
      new Request(`${b.origin}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", host: new URL(b.origin).host },
        body: JSON.stringify(body),
      }),
      b
    );
  for (const b of REAL_BRANDS) {
    check(`${b.id}: not offered PayPal with PayPal credentials set`, brandPaymentAdapters(b).every((a) => a.id !== "paypal"));
    check(`${b.id}: its storefront never offers PayPal`, storefrontView(b).payment.methods.every((m) => m.id !== "paypal"));
    const first = b.catalogue!.packs.find((p) => p.available)!;
    const deliveryOption = catalogueDeliveryOptions(b.catalogue!, first.priceMinor)[0]!.option.id;
    const res = await post(b, { lines: [{ sku: first.sku, qty: 1 }], deliveryOption });
    const body = (await res.json()) as { error?: string };
    check(`${b.id}: without Stripe, checkout is a 503 in neutral words`, res.status === 503 && body.error === CHECKOUT_UNAVAILABLE, JSON.stringify(body));
    check(`${b.id}: a method of "paypal" is refused`, (await post(b, { lines: [{ sku: first.sku, qty: 1 }], deliveryOption, method: "paypal" })).status !== 200);
  }
  check("the real brands: PayPal is never called", paypal.calls.length === callsBefore);
  // Moving a real brand to PayPal is its profile and its credentials: nothing else.
  const moved: BrandProfile = { ...brandFor("luxury"), paymentProviders: ["paypal"], payment: PAYPAL_PAYMENT };
  check("moved by its profile, a real brand is offered PayPal on its own credentials", brandPaymentAdapters(moved).map((a) => a.id).join() === "paypal" && paypalCredentials("luxury")?.clientId === "client-luxury");
  clearPayPalEnv();
  const off = await post(lux, { lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  check("a PayPal brand without credentials is a 503", off.status === 503);
  // Its pages are built without the runtime env, so the button follows the
  // profile: still there, and the 503 above is what a press of it reads.
  check("its storefront still offers PayPal, by its profile", storefrontView(lux).payment.methods.map((m) => m.id).join() === "paypal");
  check("its storefront's PayPal answers 503, not 400", (await post(lux, { lines: [{ sku: "LUX-10ML-X1", qty: 1 }], method: "paypal" })).status === 503);
  for (const b of PAYPAL_BRANDS) setPayPalEnv(b.id);
  for (const b of PAYPAL_BRANDS) {
    const methods = storefrontView(b).payment.methods;
    check(`${b.id}: configured, its storefront offers PayPal`, methods.length === 1 && methods[0]!.id === "paypal" && methods[0]!.label === "PayPal", JSON.stringify(methods));
  }

  // ── The create body, field by field ─────────────────────────────────
  for (const b of PAYPAL_BRANDS) {
    const first = b.catalogue!.packs.find((p) => p.available)!;
    const lines = [{ sku: first.sku, qty: 2 }, ...b.catalogue!.addOns.map((a) => ({ sku: a.sku, qty: 1 }))];
    const order = paymentOrder(b, lines);
    const body = paypalOrderBody(order, b) as {
      intent: string;
      purchase_units: {
        custom_id: string;
        invoice_id: string;
        soft_descriptor?: string;
        amount: { currency_code: string; value: string; breakdown: { item_total: { currency_code: string; value: string }; shipping: { currency_code: string; value: string } } };
        items: { name: string; quantity: string; unit_amount: { currency_code: string; value: string }; category: string }[];
      }[];
      payment_source: { paypal: { experience_context: Record<string, string> } };
    };
    const unit = body.purchase_units[0]!;
    const ctx = body.payment_source.paypal.experience_context;
    const pence = (v: string) => Math.round(Number(v) * 100);
    const at = `${b.id} create`;
    check(`${at}: intent CAPTURE`, body.intent === "CAPTURE");
    check(`${at}: one purchase unit`, body.purchase_units.length === 1);
    check(`${at}: custom_id and invoice_id are our order id`, unit.custom_id === ORDER_ID && unit.invoice_id === ORDER_ID);
    check(`${at}: neutral item names, as the order names them`, unit.items.every((i) => /^10ml bacteriostatic water × \d+$/.test(i.name)), unit.items.map((i) => i.name).join(" | "));
    check(`${at}: the pack's name says its vials`, unit.items[0]!.name === `10ml bacteriostatic water × ${first.vials}`);
    check(`${at}: no brand name or slang in the items`, unit.items.every((i) => !i.name.includes(b.name)) && checkCompliance(unit.items.map((i) => i.name)).length === 0);
    check(`${at}: quantities are packs, as strings`, unit.items[0]!.quantity === "2");
    check(`${at}: unit prices are the catalogue's`, pence(unit.items[0]!.unit_amount.value) === first.priceMinor);
    check(`${at}: physical goods`, unit.items.every((i) => i.category === "PHYSICAL_GOODS"));
    const itemSum = unit.items.reduce((n, i) => n + pence(i.unit_amount.value) * Number(i.quantity), 0);
    check(`${at}: item_total is the sum of the items`, pence(unit.amount.breakdown.item_total.value) === itemSum && itemSum === order.goodsMinor);
    check(`${at}: shipping is the chosen delivery's price`, pence(unit.amount.breakdown.shipping.value) === order.delivery.priceMinor);
    check(`${at}: the value is item_total plus shipping`, pence(unit.amount.value) === itemSum + order.delivery.priceMinor);
    check(
      `${at}: everything in GBP, two decimals`,
      [unit.amount, unit.amount.breakdown.item_total, unit.amount.breakdown.shipping, ...unit.items.map((i) => i.unit_amount)].every((m) => m.currency_code === "GBP" && /^\d+\.\d{2}$/.test(m.value))
    );
    check(`${at}: soft descriptor from the profile`, unit.soft_descriptor === b.statementDescriptor);
    check(`${at}: soft descriptor within PayPal's ${SOFT_DESCRIPTOR_MAX}`, (unit.soft_descriptor ?? "").length <= SOFT_DESCRIPTOR_MAX);
    check(`${at}: brand_name is the brand's name`, ctx.brand_name === b.name);
    check(`${at}: PayPal collects the address`, ctx.shipping_preference === "GET_FROM_FILE");
    check(`${at}: Pay Now`, ctx.user_action === "PAY_NOW");
    check(`${at}: en-GB`, ctx.locale === "en-GB");
    check(`${at}: no pending-for-days payments`, ctx.payment_method_preference === "IMMEDIATE_PAYMENT_REQUIRED");
    check(`${at}: return_url on the brand's origin`, ctx.return_url === `${b.origin}/api/payments/paypal/return?order=${ORDER_ID}`, ctx.return_url);
    check(`${at}: cancel_url on the brand's origin`, ctx.cancel_url === `${b.origin}/?payment=cancelled`, ctx.cancel_url);
    const text = JSON.stringify(body);
    check(`${at}: never BacLab's name or Stripe`, !/baclab|stripe/i.test(text));
    // The brand it was made from is itself; every other brand is another.
    for (const other of BRAND_IDS.filter((o) => o !== SOURCE.get(b.id) && o !== DEFAULT_BRAND)) {
      check(`${at}: never names ${other}`, !text.includes(brandFor(other).name) && !text.includes(`${other}.localhost`));
    }
  }
  {
    const long = { ...lux, statementDescriptor: "RESERVE NUMBER TEN LIMITED" };
    const unit = (paypalOrderBody(paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]), long) as { purchase_units: { soft_descriptor: string }[] }).purchase_units[0]!;
    check("create: a long descriptor is cut to 22", unit.soft_descriptor === "RESERVE NUMBER TEN LIM");
    const none = paypalOrderBody(paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]), { ...lux, statementDescriptor: undefined }) as { purchase_units: Record<string, unknown>[] };
    check("create: no descriptor when the profile has none", !("soft_descriptor" in none.purchase_units[0]!));
    const chosen = paymentOrder(bea, [{ sku: "BEA-10ML-X1", qty: 1 }], 1);
    const charged = (paypalOrderBody(chosen, bea) as { purchase_units: { amount: { value: string; breakdown: { shipping: { value: string } } } }[] }).purchase_units[0]!.amount;
    check("create: the delivery the buyer chose is what is charged", charged.breakdown.shipping.value === "5.00" && charged.value === (chosen.goodsMinor / 100 + 5).toFixed(2), JSON.stringify(charged));
    let threw = false;
    try {
      paypalOrderBody({ ...chosen, goodsMinor: chosen.goodsMinor + 1 }, bea);
    } catch {
      threw = true;
    }
    check("create: lines that do not sum to the order are refused", threw);
  }

  // ── createPayment: the request, the idempotency key, the token ─────
  __clearPayPalTokens();
  paypal.calls.length = 0;
  paypal.respond = (c) =>
    c.url.pathname === "/v2/checkout/orders" && c.method === "POST"
      ? json(200, {
          id: "PPORDER1",
          status: "PAYER_ACTION_REQUIRED",
          links: [
            { href: "https://api-m.sandbox.paypal.com/v2/checkout/orders/PPORDER1", rel: "self", method: "GET" },
            { href: "https://www.sandbox.paypal.com/checkoutnow?token=PPORDER1", rel: "payer-action", method: "GET" },
          ],
        })
      : undefined;
  const created = await paypalAdapter.createPayment(paymentOrder(lux, [{ sku: "LUX-10ML-X3", qty: 1 }]), { brand: lux });
  const createCall = paypal.calls.find((c) => c.url.pathname === "/v2/checkout/orders")!;
  check("createPayment: the buyer goes to PayPal's payer-action page", created.url === "https://www.sandbox.paypal.com/checkoutnow?token=PPORDER1" && created.ref === "PPORDER1");
  check("createPayment: on the brand's environment", createCall.url.origin === "https://api-m.sandbox.paypal.com");
  check("createPayment: a PayPal-Request-Id keyed on our order", createCall.headers.get("paypal-request-id") === `create-${ORDER_ID}`);
  check("createPayment: with the brand's own token", createCall.headers.get("authorization") === "Bearer token-1");
  const tokenCall = paypal.calls.find((c) => c.url.pathname === "/v1/oauth2/token")!;
  check("token: the brand's own client id and secret", tokenCall.headers.get("authorization") === `Basic ${Buffer.from(`client-${lux.id}:secret-${lux.id}`).toString("base64")}`);
  check("token: client credentials", tokenCall.body === "grant_type=client_credentials");
  await paypalAdapter.createPayment(paymentOrder(lux, [{ sku: "LUX-10ML-X3", qty: 1 }]), { brand: lux });
  check("token: cached per brand", paypal.tokens() === 1);
  await paypalAdapter.createPayment(paymentOrder(bea, [{ sku: "BEA-10ML-X1", qty: 1 }]), { brand: bea });
  check("token: another brand gets its own", paypal.tokens() === 2);
  let refusedOnce = false;
  paypal.respond = (c) => {
    if (c.url.pathname !== "/v2/checkout/orders") return undefined;
    if (!refusedOnce) {
      refusedOnce = true;
      return json(401, { error: "invalid_token" });
    }
    return json(201, { id: "PPORDER2", status: "PAYER_ACTION_REQUIRED", links: [{ href: "https://www.sandbox.paypal.com/checkoutnow?token=PPORDER2", rel: "payer-action" }] });
  };
  const again = await paypalAdapter.createPayment(paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]), { brand: lux });
  check("token: a 401 renews it and retries once", again.ref === "PPORDER2" && paypal.tokens() === 3);
  const refuse = async (respond: (c: PayPalCall) => Response | undefined) => {
    paypal.respond = respond;
    try {
      await paypalAdapter.createPayment(paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]), { brand: lux });
      return false;
    } catch {
      return true;
    }
  };
  check("createPayment: a refusal throws", await refuse(() => json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "DUPLICATE_INVOICE_ID" }] })));
  check("createPayment: a link off PayPal is never followed", await refuse(() => json(201, { id: "X", links: [{ rel: "payer-action", href: "https://evil.example/pay" }] })));
  check("createPayment: no link at all throws", await refuse(() => json(201, { id: "X", links: [] })));

  // ── Capture: the same request id every time ─────────────────────────
  paypal.calls.length = 0;
  const creds = paypalCredentials(lux.id)!;
  paypal.respond = (c) =>
    c.url.pathname === "/v2/checkout/orders/PPORDER1/capture"
      ? json(201, paypalOrderJson({ id: "PPORDER1", status: "COMPLETED", customId: ORDER_ID, capture: { id: "CAPTURE1", status: "COMPLETED", value: "21.99" } }))
      : undefined;
  const one = await capturePayPalOrder(creds, "PPORDER1", ORDER_ID);
  const two = await capturePayPalOrder(creds, "PPORDER1", ORDER_ID);
  const captureCalls = paypal.calls.filter((c) => c.url.pathname.endsWith("/capture"));
  check("capture: idempotent, one request id for every attempt", captureCalls.length === 2 && captureCalls.every((c) => c.headers.get("paypal-request-id") === `capture-${ORDER_ID}`));
  check("capture: asks for the full order back", captureCalls.every((c) => c.headers.get("prefer") === "return=representation"));
  check("capture: read back", one.ok && two.ok && one.order.capture?.id === "CAPTURE1" && one.order.capture.amountMinor === 2199);
  paypal.respond = () => json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] });
  const dup = await capturePayPalOrder(creds, "PPORDER1", ORDER_ID);
  check("capture: already captured is an answer, not a throw", !dup.ok && dup.issue === "ORDER_ALREADY_CAPTURED");
  paypal.respond = () => json(503, { name: "SERVICE_UNAVAILABLE" });
  let threw503 = false;
  try {
    await capturePayPalOrder(creds, "PPORDER1", ORDER_ID);
  } catch {
    threw503 = true;
  }
  check("capture: PayPal down throws, so a webhook is retried", threw503);

  // ── Reading a captured order ───────────────────────────────────────
  const read = readPayPalOrder(paypalOrderJson({ id: "PPORDER1", status: "COMPLETED", customId: ORDER_ID, capture: { id: "CAPTURE1", status: "COMPLETED", value: "43.98" } }));
  check("read: the buyer", read.name === "Sam Buyer" && read.email === "buyer@example.com" && read.phone === "07700900123");
  check(
    "read: the address in the Stripe webhook's shape",
    JSON.stringify(read.address) === JSON.stringify({ line1: "1 Mill Lane", line2: "Flat 2", city: "Leeds", country: "GB", postalCode: "LS1 1AA" })
  );
  check("read: the capture", read.capture?.id === "CAPTURE1" && read.capture.status === "COMPLETED" && read.capture.amountMinor === 4398 && read.capture.currency === "GBP");
  check("read: our id", read.customId === ORDER_ID);

  // ── The amount check ────────────────────────────────────────────────
  const row = { id: ORDER_ID, totalAmount: "43.98" as unknown as never, deliveryMinor: 390 };
  check("amount: goods plus delivery match", amountMismatch(row, { amountMinor: 4788, currency: "GBP" }) === null);
  check("amount: a different figure is logged", /AMOUNT MISMATCH on order/.test(amountMismatch(row, { amountMinor: 4398, currency: "GBP" }) ?? ""));
  check("amount: another currency is logged", /AMOUNT MISMATCH/.test(amountMismatch(row, { amountMinor: 4788, currency: "EUR" }) ?? ""));

  // ── Webhooks: which environment, and the signature ──────────────────
  check("cert: sandbox", certEnvironment("https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1") === "sandbox");
  check("cert: sandbox (api-m)", certEnvironment("https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1") === "sandbox");
  check("cert: live", certEnvironment("https://api.paypal.com/v1/notifications/certs/CERT-1") === "live");
  check("cert: not PayPal", certEnvironment("https://paypal.com.evil.example/c") === null && certEnvironment("http://api.paypal.com/c") === null && certEnvironment(null) === null);
  const raw = JSON.stringify({ id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource_type: "capture", resource: { id: "CAPTURE1", custom_id: ORDER_ID, amount: { value: "21.99" } } }, null, 1);
  paypal.calls.length = 0;
  paypal.respond = () => json(200, { verification_status: "SUCCESS" });
  check("verify: SUCCESS is genuine", await verifyPayPalWebhook(creds, webhookHeaders("sandbox"), raw));
  const sent = paypal.calls.find((c) => c.url.pathname === "/v1/notifications/verify-webhook-signature")!;
  check("verify: asked of the brand's own environment", sent.url.origin === "https://api-m.sandbox.paypal.com");
  check("verify: the event goes back exactly as it arrived", sent.body.endsWith(`"webhook_event":${raw}}`));
  const parsed = JSON.parse(sent.body) as Record<string, string>;
  check("verify: with the brand's own webhook id", parsed.webhook_id === `webhook-${lux.id}`);
  check(
    "verify: every transmission header",
    parsed.auth_algo === "SHA256withRSA" && parsed.transmission_id === "transmission-fixture" && parsed.transmission_sig === "signature-fixture" && parsed.transmission_time === "2026-11-04T10:00:00Z" && /certs\/CERT-fixture$/.test(parsed.cert_url ?? "")
  );
  paypal.respond = () => json(200, { verification_status: "FAILURE" });
  check("verify: FAILURE is refused", !(await verifyPayPalWebhook(creds, webhookHeaders("sandbox"), raw)));
  paypal.calls.length = 0;
  const bare = webhookHeaders("sandbox");
  bare.delete("paypal-transmission-sig");
  check("verify: a missing header is refused without asking PayPal", !(await verifyPayPalWebhook(creds, bare, raw)) && paypal.calls.length === 0);
  check("webhook: a payload that is not JSON is a 400", (await handlePayPalWebhook("{", webhookHeaders("sandbox"))).status === 400);

  // Which order an event names.
  const approved: PayPalEvent = { id: "WH-2", event_type: "CHECKOUT.ORDER.APPROVED", resource_type: "checkout-order", resource: { id: "PPORDER1", purchase_units: [{ custom_id: ORDER_ID }] } };
  const completed: PayPalEvent = {
    id: "WH-3",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource_type: "capture",
    resource: { id: "CAPTURE1", custom_id: ORDER_ID, supplementary_data: { related_ids: { order_id: "PPORDER1" } } },
  };
  const refunded: PayPalEvent = {
    id: "WH-4",
    event_type: "PAYMENT.CAPTURE.REFUNDED",
    resource_type: "refund",
    resource: { id: "REFUND1", links: [{ rel: "up", href: "https://api.paypal.com/v2/payments/captures/CAPTURE1" }] },
  };
  check("refs: an approved order", JSON.stringify(eventRefs(approved)) === JSON.stringify({ orderId: ORDER_ID, captureId: null, paypalOrderId: "PPORDER1" }));
  check("refs: a completed capture", JSON.stringify(eventRefs(completed)) === JSON.stringify({ orderId: ORDER_ID, captureId: "CAPTURE1", paypalOrderId: "PPORDER1" }));
  check("refs: a refund, by its capture", JSON.stringify(eventRefs(refunded)) === JSON.stringify({ orderId: null, captureId: "CAPTURE1", paypalOrderId: null }));

  // ── The return's destination ────────────────────────────────────────
  const loc = (outcome: Parameters<typeof returnRedirect>[2]) => returnRedirect(lux, ORDER_ID, outcome).headers.get("location");
  check("return: paid goes to the confirmation, marked", loc("paid") === `${lux.origin}/order-confirmation/${ORDER_ID}?paid=1`);
  check("return: the confirmation reads the marker", returnedFromPayment({ paid: "1" }));
  check("return: a duplicate goes there too", loc("already-paid") === loc("paid"));
  check("return: declined, back to the buy section", loc("declined") === `${lux.origin}/?payment=declined#buy`);
  check("return: not approved reads as cancelled", loc("not-approved") === `${lux.origin}/?payment=cancelled#buy`);
  check("return: a 303", returnRedirect(lux, ORDER_ID, "failed").status === 303);
  for (const code of ["cancelled", "declined", "pending", "address", "failed"]) {
    const message = paymentReturnMessage(code);
    check(`message: "${code}" has words`, !!message);
    check(`message: "${code}" names no provider`, !/paypal|stripe|card/i.test(message ?? ""));
    for (const id of BRAND_IDS.filter((x) => x !== DEFAULT_BRAND)) {
      check(`message: "${code}" passes ${id}'s copy rules`, checkBrandCopy(id as BrandId, message ?? "").length === 0);
    }
  }
  check("message: unknown codes say nothing", paymentReturnMessage("constructor") === null && paymentReturnMessage(null) === null);

  // ── The nightly clear-up, for PayPal orders ─────────────────────────
  const now = new Date("2026-11-04T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  const pending = (createdAt: Date) => ({ id: ORDER_ID, brand: lux.id, paymentProvider: "paypal", paymentRef: "PPORDER1", notes: null, createdAt });
  const neverStripe = async () => {
    throw new Error("Stripe asked about a PayPal order");
  };
  const state = (s: PayPalOrderState) => async () => s;
  const verdict = (createdAt: Date, s: PayPalOrderState | Error) =>
    abandonedVerdict(pending(createdAt), now, neverStripe, s instanceof Error ? async () => Promise.reject(s) : state(s));
  check("clear-up: paid at PayPal but not here is kept", !(await verdict(hoursAgo(200), "completed")).clear);
  check("clear-up: an order PayPal no longer has is cleared", (await verdict(hoursAgo(2), "gone")).clear);
  check("clear-up: an open one is kept while PayPal could still take it", !(await verdict(hoursAgo(10), "open")).clear && !(await verdict(hoursAgo(10), "approved")).clear);
  check("clear-up: an open one is cleared after PayPal's longest window", (await verdict(hoursAgo(73), "open")).clear);
  check("clear-up: PayPal unreachable keeps it", !(await verdict(hoursAgo(200), new Error("down"))).clear);
  check("clear-up: no credentials: the age rule", (await verdict(hoursAgo(73), "unconfigured")).clear && !(await verdict(hoursAgo(10), "unconfigured")).clear);
  check(
    "clear-up: no PayPal order attached: the hour rule",
    (await abandonedVerdict({ ...pending(hoursAgo(2)), paymentRef: null }, now, neverStripe, state("open"))).clear
  );

  paypal.restore();
  clearPayPalEnv();
  if (failures > 0) {
    console.error(`\n${failures} PayPal check(s) failed`);
    process.exit(1);
  }
  console.log("PayPal checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
