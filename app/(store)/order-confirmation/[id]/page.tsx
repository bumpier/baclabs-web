import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { brand } from "@/config/brand";
import { formatMinor } from "@/config/funnel";
import { PurchaseTracker } from "./PurchaseTracker";

export const dynamic = "force-dynamic";

/** Pence from a decimal string, so every figure here is integer arithmetic. */
function toMinor(value: string): number {
  return Math.round(Number(value) * 100);
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string; paid?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // Order IDs are UUIDs — unguessable, so showing the summary here is safe.
  if (!z.string().uuid().safeParse(id).success) notFound();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  const items = JSON.parse(order.items) as {
    name: string;
    qty: number;
    unitPrice: string;
    bundleName?: string;
    bundleQty?: number;
  }[];

  const paid = order.status !== "pending" && order.status !== "cancelled";
  // Stripe returns the browser here the moment the card clears, which usually
  // beats the webhook. Without this the card customer reads the crypto
  // "we're waiting for your payment" copy at the one moment that must feel
  // finished. Presentation only — the marker is user-typeable, so it drives
  // no data change; the order's real status still comes from the webhook.
  const confirming =
    !paid &&
    order.status === "pending" &&
    order.paymentProvider === "stripe" &&
    (Boolean(sp.session_id) || sp.paid === "stripe");

  const hasEmail = Boolean(brand.contact.email);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      {/* Pick up the webhook's result without the customer having to reload. */}
      {confirming ? <meta httpEquiv="refresh" content="5" /> : null}

      {/* Fires `purchase` once, and only for an order that is actually paid. */}
      {paid ? (
        <PurchaseTracker
          orderId={order.id}
          valueMinor={toMinor(order.totalAmount.toString())}
          items={items.map((i) => ({
            item_id: i.bundleName ?? "baclab-10ml",
            item_name: i.name,
            price: Number(i.unitPrice),
            quantity: i.qty,
          }))}
        />
      ) : null}

      <h1 className="text-3xl">
        {paid
          ? "Thank you — your order is confirmed"
          : confirming
            ? "Payment received"
            : "Order received"}
      </h1>
      <p className="measure mt-3 text-base text-ink-soft">
        {paid
          ? "Payment has cleared and your order is being prepared."
          : confirming
            ? "Your payment went through. We are confirming the order now — this page updates itself in a few seconds."
            : "We are waiting for your payment to be confirmed. This page shows the latest status whenever you reload it."}
      </p>

      <dl className="panel mt-8 p-5 text-sm sm:p-6">
        <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-4 text-ink-soft">
          <div>
            <dt className="inline">Order </dt>
            <dd className="tabular inline text-ink">{order.id}</dd>
          </div>
          <div>
            <dt className="sr-only">Placed</dt>
            <dd>
              <time dateTime={order.createdAt.toISOString()}>
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(order.createdAt)}
              </time>
            </dd>
          </div>
        </div>

        <div className="divide-y divide-line">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-4 py-3">
              <dt className="text-ink">
                {item.name} <span className="tabular text-ink-soft">× {item.qty}</span>
                {item.bundleName && item.bundleQty ? (
                  <span className="block text-xs text-ink-soft">
                    <span className="tabular">{item.bundleQty}</span> × {item.bundleName}
                  </span>
                ) : null}
              </dt>
              <dd className="tabular shrink-0 text-ink">
                {formatMinor(toMinor(item.unitPrice) * item.qty)}
              </dd>
            </div>
          ))}
        </div>

        <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold">
          <dt>Total paid</dt>
          <dd className="tabular">{formatMinor(toMinor(order.totalAmount.toString()))}</dd>
        </div>
      </dl>

      <section className="mt-10" aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-xl">
          What happens next
        </h2>
        <ol className="measure mt-4 space-y-3 text-base text-ink-soft">
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-brand" />
            <span>
              A confirmation email is on its way
              {order.customerEmail ? (
                <>
                  {" "}
                  to <span className="font-medium text-ink">{order.customerEmail}</span>
                </>
              ) : null}
              . Stripe also emails its own payment receipt.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-brand" />
            <span>We pack your order and dispatch it to the address you gave at checkout.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-brand" />
            <span>You get a second email when it ships.</span>
          </li>
        </ol>
      </section>

      <p className="mt-10 text-sm text-ink-soft">
        Something not right?{" "}
        {hasEmail ? (
          <>
            Email{" "}
            <a href={`mailto:${brand.contact.email}`} className="link">
              {brand.contact.email}
            </a>{" "}
            quoting your order number.
          </>
        ) : (
          <Link href="/contact" className="link">
            Get in touch
          </Link>
        )}
      </p>

      <p className="mt-8">
        <Link href="/" className="link">
          Back to the order page
        </Link>
      </p>
    </div>
  );
}
