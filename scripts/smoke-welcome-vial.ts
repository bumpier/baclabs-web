// Smoke test for the welcome vial's one-per-household rule
// (settleWelcomeVial in lib/mailing-list.ts) against a real SQLite database,
// paid through fulfillPaidOrder as a webhook would: a second signup by the
// same person, under a Gmail alias, a fresh address or another subscriber's
// email link, gets no vial; a new household and a neighbour do. Also checks
// that mailboxOrderCount's SQL agrees with canonicalEmail().
//
// It deletes orders and subscribers and flips the shop-wide inventory_mode
// setting, so it REFUSES to run against the real database. Point it at a
// throwaway file:
//
//   export DATABASE_URL="file:/tmp/smoke-welcome-vial.db"
//   npx prisma migrate deploy
//   npx tsx scripts/smoke-welcome-vial.ts
import { prisma } from "../lib/db";
import { fulfillPaidOrder } from "../lib/payments/fulfillment";
import { setInventoryMode } from "../lib/inventory/mode";
import { canonicalEmail, isWelcomeItem, mailboxOrderCount, welcomeItem } from "../lib/mailing-list";
import { clearOptOut, isOptedOut, optedOutEmails, optOut, suppressEverywhere } from "../lib/opt-outs";
import { registerTestBrand, TEST_BRAND_ID } from "./fixtures/test-brand";

if (!process.env.DATABASE_URL || /data\/baclab\.db/.test(process.env.DATABASE_URL)) {
  console.error("Refusing to run: set DATABASE_URL to a throwaway database (see the header of this file).");
  process.exit(1);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

let productId = "";

type Delivery = { name: string; line1: string; postcode: string };
const HOME: Delivery = { name: "Jo Smith", line1: "12 High St", postcode: "SW1A 1AA" };

const subscribe = (email: string, brand?: string) =>
  prisma.subscriber.create({
    data: { email, status: "subscribed", source: "footer", consentText: "smoke", ...(brand ? { brand } : {}) },
  });

/**
 * Pay for a 5-pack as `email`, to `to`. `welcomeFor` is the subscriber whose
 * vial checkout put on the order (a browser with their cookie); without it
 * fulfilment matches the email instead. `brand` left out is BacLab.
 */
async function pay(email: string, to: Delivery, welcomeFor?: string, brand?: string) {
  const order = await prisma.order.create({
    data: {
      ...(brand ? { brand } : {}),
      status: "pending",
      customerName: to.name,
      customerEmail: email,
      shippingAddress: JSON.stringify({ line1: to.line1, line2: null, city: "London", country: "GB", postalCode: to.postcode }),
      items: JSON.stringify([
        { productId, slug: "baclab-10ml", name: "Bacteriostatic Water 10ml vial", qty: 5, unitPrice: "21.99", lineTotal: "21.99", bundleId: "five", bundleName: "5-vial pack", bundleQty: 1 },
        ...(welcomeFor ? [welcomeItem(productId, "baclab-10ml")] : []),
      ]),
      currency: "GBP",
      totalAmount: 21.99,
      paymentMethod: "card",
      ...(welcomeFor ? { welcomeSubscriberId: welcomeFor } : {}),
    },
  });
  await fulfillPaidOrder(order.id, { provider: "stripe" });
  const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  return { order: paid, vial: (JSON.parse(paid.items) as object[]).some(isWelcomeItem) };
}

const claimedBy = async (subscriberId: string) =>
  (await prisma.subscriber.findUniqueOrThrow({ where: { id: subscriberId } })).welcomeOrderId;

async function main() {
  await prisma.vialGift.deleteMany();
  await prisma.pickLine.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.product.deleteMany({ where: { slug: "baclab-10ml" } });
  await setInventoryMode("legacy");
  const product = await prisma.product.create({
    data: { slug: "baclab-10ml", name: "Vial", description: "Smoke fixture", priceGbp: 5.99, stock: 100, weightGrams: 25 },
  });
  productId = product.id;

  // ── A household's first order gets the vial ────────────────────────
  const jo = await subscribe("jo.smith@gmail.com");
  const first = await pay("jo.smith@gmail.com", HOME);
  assert(first.vial, "a subscriber's first order gets the welcome vial");
  assert((await claimedBy(jo.id)) === first.order.id, "…and claims it");

  // ── The same person again, by a Gmail alias, elsewhere ──────────────
  const alias = await subscribe("josmith+2@googlemail.com");
  assert((await mailboxOrderCount(alias.email)) === 1, "a Gmail alias counts the mailbox's orders");
  const byAlias = await pay(alias.email, { name: "J Smith", line1: "Flat 3, 9 Mill Lane", postcode: "M1 1AA" });
  assert(!byAlias.vial, "a Gmail alias of a customer gets no vial, even to another address");
  assert((await claimedBy(alias.id)) === null, "…and its gift is not claimed");

  // ── Another email, the same door ────────────────────────────────────
  const other = await subscribe("jsmith@outlook.com");
  const sameDoor = await pay(other.email, { name: "Jay Smith", line1: "12 high st.", postcode: "sw1a1aa" });
  assert(!sameDoor.vial, "a fresh email delivering to the same address gets no vial");
  assert((sameDoor.order.notes ?? "").includes("No welcome vial"), "…and the order says why");
  const sameName = await pay((await subscribe("jo@yahoo.co.uk")).email, { name: "jo smith", line1: "12 High Street", postcode: "SW1A 1AA" });
  assert(!sameName.vial, "the same name at the same postcode gets no vial, however the street is spelt");

  // ── Another subscriber's email link, paid as an existing customer ───
  // A link cookie leaves Stripe's email free, so checkout puts the vial on
  // and the payer is someone else: fulfilment takes it back off.
  const throwaway = await subscribe("burner1@outlook.com");
  const viaLink = await pay("jo.smith@gmail.com", { name: "Jo Smith", line1: "1 New Road", postcode: "LS2 2BB" }, throwaway.id);
  assert(!viaLink.vial, "a vial from checkout is removed when the payer has ordered before");
  assert((viaLink.order.notes ?? "").includes("Welcome vial removed"), "…and the order says why");
  assert(viaLink.order.welcomeSubscriberId === null, "…and the order is not linked to the subscriber");
  assert((await claimedBy(throwaway.id)) === null, "…and that subscriber's gift is left unclaimed");

  // ── Genuine first orders still get it ──────────────────────────────
  const fresh = await subscribe("new.person@outlook.com");
  const freshPaid = await pay(fresh.email, { name: "New Person", line1: "5 Oak Lane", postcode: "LS6 3CC" }, fresh.id);
  assert(freshPaid.vial, "a new household paying with the cookie keeps the vial from checkout");
  assert((await claimedBy(fresh.id)) === freshPaid.order.id, "…and claims it");
  const neighbour = await pay((await subscribe("pat@outlook.com")).email, { name: "Pat Lee", line1: "14 High St", postcode: "SW1A 1AA" });
  assert(neighbour.vial, "a neighbour at the same postcode gets their own vial");

  // ── A second brand ─────────────────────────────────────────────────
  // Each brand has its own list and gives its own subscribers the vial, but
  // it is the same vial: a mailbox or household that has ordered from one
  // brand has had its first order everywhere, and the note names no brand.
  registerTestBrand();
  const samBaclab = await subscribe("sam.two@outlook.com");
  const samFx = await subscribe("sam.two@outlook.com", TEST_BRAND_ID);
  assert(samBaclab.id !== samFx.id, "one address can be on two brands' lists");
  const samFirst = await pay(samFx.email, { name: "Sam Two", line1: "7 Elm Road", postcode: "BS1 4DD" }, undefined, TEST_BRAND_ID);
  assert(samFirst.vial, "a brand's subscriber gets the vial on that brand's first order");
  assert((await claimedBy(samFx.id)) === samFirst.order.id, "…claimed by that brand's subscriber");
  assert((await claimedBy(samBaclab.id)) === null, "…not by the same address on BacLab's list");
  const samBaclabOrder = await pay(samBaclab.email, { name: "Sam Two", line1: "9 Ash Road", postcode: "BS2 5EE" });
  assert(!samBaclabOrder.vial, "after an order with one brand, no vial from another: the mailbox check spans brands");
  assert(
    (samBaclabOrder.order.notes ?? "") === "" || !/fixture|baclab/i.test(samBaclabOrder.order.notes ?? ""),
    "…and nothing on the order names a brand"
  );
  const fxOnly = await subscribe("only.fx@outlook.com", TEST_BRAND_ID);
  const fxOnlyOnBaclab = await pay(fxOnly.email, { name: "Only Fx", line1: "3 Pine Way", postcode: "CF10 1AA" });
  assert(!fxOnlyOnBaclab.vial, "another brand's subscriber gets no vial on a BacLab order");
  assert((await claimedBy(fxOnly.id)) === null, "…and their own brand's gift stays waiting");
  const fxHome = { name: "Fx Home", line1: "21 Birch Close", postcode: "EH1 1AA" };
  await pay("first.fx@outlook.com", fxHome, undefined, TEST_BRAND_ID);
  const fxDoorBaclab = await pay((await subscribe("second.fx@outlook.com")).email, fxHome);
  assert(!fxDoorBaclab.vial, "a household that ordered from another brand gets no BacLab vial");
  assert(
    (fxDoorBaclab.order.notes ?? "").includes("No welcome vial") && !/fixture|baclab/i.test(fxDoorBaclab.order.notes ?? ""),
    "…and the note says why without naming a brand"
  );

  // ── Opt-outs are per brand; a suppression is for every brand ──────────
  await optOut("leave.fx@outlook.com", TEST_BRAND_ID);
  assert(await isOptedOut("Leave.Fx@Outlook.com", TEST_BRAND_ID), "an opt-out stops that brand");
  assert(!(await isOptedOut("leave.fx@outlook.com", "baclab")), "…and not another");
  await suppressEverywhere("bounced@outlook.com");
  assert(
    (await isOptedOut("bounced@outlook.com", "baclab")) && (await isOptedOut("bounced@outlook.com", TEST_BRAND_ID)),
    "a suppression stops every brand"
  );
  await clearOptOut("bounced@outlook.com", "baclab");
  assert(await isOptedOut("bounced@outlook.com", "baclab"), "a fresh signup does not lift a suppression");
  await optOut("back@outlook.com", "baclab");
  await optOut("back@outlook.com", TEST_BRAND_ID);
  await clearOptOut("back@outlook.com", "baclab");
  assert(
    !(await isOptedOut("back@outlook.com", "baclab")) && (await isOptedOut("back@outlook.com", TEST_BRAND_ID)),
    "a fresh signup lifts only its own brand's opt-out"
  );
  const fxOptOuts = await optedOutEmails(TEST_BRAND_ID);
  assert(fxOptOuts.has("leave.fx@outlook.com") && fxOptOuts.has("bounced@outlook.com") && fxOptOuts.has("back@outlook.com"), "a brand's audience leaves out its opt-outs and every suppression");
  assert(!(await optedOutEmails("baclab")).has("leave.fx@outlook.com"), "…and not another brand's opt-outs");
  await prisma.emailOptOut.deleteMany({ where: { email: { endsWith: "@outlook.com" } } });

  // ── mailboxOrderCount's SQL agrees with canonicalEmail() ────────────
  const emails = ["A.B+x@GoogleMail.com", "ab@gmail.com", " Spaced@Foo.com ", "x+1@foo.com", "+x@foo.com", "x@foo.com", "x.y@foo.com", "noat", ""];
  for (const email of emails) {
    await prisma.order.create({
      data: { status: "paid", customerName: "", customerEmail: email, shippingAddress: "", items: "[]", currency: "GBP", totalAmount: 0, paymentMethod: "card" },
    });
  }
  const placed = await prisma.order.findMany({ where: { status: { notIn: ["pending", "cancelled"] } }, select: { customerEmail: true } });
  const probes = [...emails, "a.b@gmail.com", "spaced@foo.com", "x@foo.com", "xy@foo.com", "jo.smith@gmail.com", "nobody@nowhere.test"];
  for (const probe of probes) {
    if (!probe.includes("@")) continue;
    const expected = placed.filter((o) => o.customerEmail.includes("@") && !o.customerEmail.trim().startsWith("@") && canonicalEmail(o.customerEmail) === canonicalEmail(probe)).length;
    const got = await mailboxOrderCount(probe);
    assert(got === expected, `mailboxOrderCount(${JSON.stringify(probe)}) = ${got}, canonicalEmail() says ${expected}`);
  }

  console.log("\nsmoke-welcome-vial: all passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
