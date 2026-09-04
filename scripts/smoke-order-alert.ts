// Smoke test for the admin new-order alert builder. Run with:
//   npx tsx scripts/smoke-order-alert.ts
import { buildNewOrderAlert } from "../lib/customer-email";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

const order = {
  id: "ord_test_123",
  status: "paid",
  customerName: "Jane Buyer",
  customerEmail: "jane@example.com",
  customerPhone: "+10000000000",
  shippingAddress: JSON.stringify({
    line1: "1 Test St",
    line2: null,
    city: "Dubai",
    country: "UAE",
    postalCode: "00000",
  }),
  items: JSON.stringify([
    { productId: "p1", slug: "reta", name: "Retatrutide Pen", qty: 2, unitPrice: "100.00", unitPriceUsd: "100.00" },
  ]),
  currency: "USD",
  totalAmount: "180.00",
  paymentMethod: "usdt",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const { subject, html } = buildNewOrderAlert(order);

assert(/new paid order/i.test(subject), "subject announces a new paid order");
assert(subject.includes("Jane Buyer"), "subject names the customer");
assert(html.includes("ord_test_123"), "html includes the order id");
assert(html.includes("jane@example.com"), "html includes the customer email");
assert(html.includes("+10000000000"), "html includes the customer phone");
assert(html.includes("Retatrutide Pen"), "html lists the ordered item");
assert(html.includes("Dubai"), "html includes the shipping address");

console.log("\nAll order-alert assertions passed.");
