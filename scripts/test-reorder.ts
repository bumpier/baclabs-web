/**
 * Test suite for the reorder link and offer: lib/pack-link.ts and
 * lib/reorder.ts, which the "Running low?" email and the buy box's
 * usePackQuery share. Run with `npm run test:reorder`. Exits non-zero on any
 * failure.
 */
import {
  BUNDLES,
  MAX_EXTRA_VIALS,
  MAX_QUANTITY,
  MIN_QUANTITY,
  bundleById,
  deliveryMinorFor,
  formatMinor,
  priceOrder,
} from "@/config/funnel";
import { deliveredEmail } from "@/lib/customer-email";
import { packLink, parsePackQuery } from "@/lib/pack-link";
import { reorderOffer } from "@/lib/reorder";
import { buildOrderItems } from "@/lib/order-items";
import { welcomeItem } from "@/lib/mailing-list";
import { upsellCopy, upsellFor } from "@/lib/upsell";
import { checkCompliance } from "@/lib/content-rules";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const searchOf = (link: string) => link.slice(link.indexOf("?"), link.indexOf("#"));

process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "on";
const copy: string[] = [];

for (const b of BUNDLES) {
  for (let q = MIN_QUANTITY; q <= MAX_QUANTITY; q++) {
    for (let e = 0; e <= MAX_EXTRA_VIALS; e++) {
      const priced = priceOrder(b, q, e);
      if (!priced) continue;
      const at = `${q} × ${b.id} + ${e}`;

      // The link round-trips to the same selection.
      const link = packLink({ bundleId: b.id, quantity: q, extraVials: e });
      check(`${at}: link opens the buy box`, link.startsWith("/?") && link.endsWith("#buy"), link);
      const back = parsePackQuery(searchOf(link));
      check(
        `${at}: link round-trips`,
        back?.bundleId === b.id && back.quantity === q && back.extraVials === e,
        JSON.stringify(back)
      );

      // An order of this, reordered.
      const lines = buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: b, quantity: q, priced, goodsUsd: "1.00" });
      const offer = reorderOffer(JSON.stringify([...lines, welcomeItem("p", "baclab-10ml", 1)]));
      check(`${at}: an offer`, offer !== null);
      if (!offer) continue;
      check(`${at}: the same order`, offer.bundle.id === b.id && offer.quantity === q && offer.extraVials === e);
      check(`${at}: at today's price`, offer.goodsMinor === priced.goodsMinor);
      check(`${at}: with today's delivery`, offer.deliveryMinor === deliveryMinorFor(priced.goodsMinor));
      check(`${at}: its link is the order's`, offer.link === link, offer.link);

      const next = upsellFor(b, q, e);
      check(`${at}: a step up exactly when the buy box has one`, (offer.upsell === null) === (next === null));
      if (offer.upsell && next) {
        check(`${at}: the step's words are the buy box's`, offer.upsell.line === upsellCopy(next).line);
        const to = parsePackQuery(searchOf(offer.upsell.link));
        check(
          `${at}: the step's link is the offer`,
          to?.bundleId === next.to.bundle.id && to.quantity === next.to.quantity && to.extraVials === next.to.extraVials,
          offer.upsell.link
        );
        copy.push(offer.upsell.line, offer.upsell.linkText);
      }
    }
  }
}

// The 10-pack buyer is offered the one loose vial; once they have it, nothing.
{
  const ten = bundleById("ten")!;
  const plain = reorderOffer(JSON.stringify(buildOrderItems({ productId: "p", slug: "s", bundle: ten, quantity: 1, priced: priceOrder(ten, 1)!, goodsUsd: "1" })));
  check("10-pack: offered the top-up", plain?.upsell?.linkText === "Add 1 vial", plain?.upsell?.linkText);
  check("10-pack: top-up link adds the vial", plain?.upsell?.link === "/?pack=ten&extra=1#buy", plain?.upsell?.link);
}

// Links that name nothing we sell, or ask for too much.
check("junk pack: no selection", parsePackQuery("?pack=seven") === null);
check("no pack: no selection", parsePackQuery("?plan=five-6") === null);
check("quantity clamped high", parsePackQuery("?pack=five&qty=99")?.quantity === MAX_QUANTITY);
check("quantity clamped low", parsePackQuery("?pack=five&qty=0")?.quantity === MIN_QUANTITY);
check("junk quantity is one", parsePackQuery("?pack=five&qty=lots")?.quantity === 1);
check("too many loose vials dropped", parsePackQuery("?pack=ten&extra=9")?.extraVials === 0);
check("loose vials on singles dropped", parsePackQuery("?pack=single&extra=1")?.extraVials === 0);

// Orders from before bundles, or unreadable, fall back to the generic email.
check("vial-only legacy order: no offer", reorderOffer(JSON.stringify([{ productId: "p", slug: "s", name: "x", qty: 3 }])) === null);
check("unreadable items: no offer", reorderOffer("not json") === null);
check("only a welcome vial: no offer", reorderOffer(JSON.stringify([welcomeItem("p", "s", 1)])) === null);

// The delivered email: the reorder button for a one-off sale, the plain notice otherwise.
{
  const ten = bundleById("ten")!;
  const items = JSON.stringify(buildOrderItems({ productId: "p", slug: "s", bundle: ten, quantity: 1, priced: priceOrder(ten, 1)!, goodsUsd: "1" }));
  const order = { id: "ord-9", customerName: "Sam", customerEmail: "sam@example.test", items };
  const offer = reorderOffer(items)!;
  const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const sold = deliveredEmail(order, { offers: true, giftVials: 0 });
  const soldText = textOf(sold.html);
  check("delivered: same subject", sold.subject.endsWith("order has been delivered"), sold.subject);
  check("delivered: button opens the buy box on the same order", sold.html.includes(`${offer.link}"`), offer.link);
  check("delivered: button names the vials and today's price", soldText.includes(`Reorder 10 vials · ${formatMinor(offer.goodsMinor)}`), soldText);
  check("delivered: the step up", soldText.includes(offer.upsell!.line) && sold.html.includes(offer.upsell!.link));
  check("delivered: order page still linked", sold.html.includes("/order-confirmation/ord-9"));
  check("delivered: unsubscribe link", sold.html.includes("/api/email/unsubscribe?email=sam%40example.test"));
  check("delivered: no gift line without a gift", !soldText.includes("we promised you"));
  check("delivered: no discount offered", !/\b(code|discount|% off)\b/i.test(soldText));
  copy.push(soldText);

  const gifted = textOf(deliveredEmail(order, { offers: true, giftVials: 2 }).html);
  check("delivered: waiting gift vials named", gifted.includes("The 2 free 10ml vials we promised you are still waiting"), gifted);
  copy.push(gifted);

  const plain = deliveredEmail(order, { offers: false, giftVials: 0 }).html;
  check("delivered, no offers: no reorder button", !plain.includes("Reorder") && !plain.includes("#buy"));
  check("delivered, no offers: no unsubscribe line", !plain.includes("/api/email/unsubscribe"));
  check("delivered, no offers: view your order", plain.includes("/order-confirmation/ord-9") && plain.includes("View your order"));

  const legacy = deliveredEmail(
    { ...order, items: JSON.stringify([{ productId: "p", slug: "s", name: "x", qty: 3 }]) },
    { offers: true, giftVials: 0 }
  ).html;
  check("delivered, legacy order: the buy box", legacy.includes('/#buy"') && legacy.includes("Choose your pack"));
}

// The words the email adds obey the site's content rules.
const violations = checkCompliance(copy);
check("reorder copy passes the content rules", violations.length === 0, JSON.stringify(violations.slice(0, 3)));

if (failures > 0) {
  console.error(`\n${failures} reorder check(s) failed.`);
  process.exit(1);
}
console.log("Reorder checks passed.");
