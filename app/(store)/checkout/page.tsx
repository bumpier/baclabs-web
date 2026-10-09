import { Suspense } from "react";
import Link from "next/link";
import { CheckoutForm } from "./CheckoutForm";
import { getPaymentConfig } from "@/lib/payments/config";
import { bundleById, DEFAULT_BUNDLE_ID, MAX_QUANTITY, MIN_QUANTITY, priceOrder } from "@/config/funnel";

export const dynamic = "force-dynamic";

/**
 * The crypto payment path.
 *
 * Cards never reach this page — they go straight to Stripe's hosted checkout,
 * which collects the delivery address itself. The crypto gateway returns only
 * a wallet and a QR, so this path has to gather an address before it can
 * create a payment.
 *
 * The tier, quantity and any loose vials arrive as query parameters from
 * the purchase block and are re-resolved from config here; nothing about the
 * price is trusted from the URL.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; qty?: string; extra?: string }>;
}) {
  const { methods } = getPaymentConfig();
  const coins = methods.filter((m) => m !== "card");
  const sp = await searchParams;

  const bundle = bundleById(sp.tier ?? "") ?? bundleById(DEFAULT_BUNDLE_ID)!;
  const parsedQty = Number.parseInt(sp.qty ?? "1", 10);
  const quantity = Number.isFinite(parsedQty)
    ? Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, parsedQty))
    : MIN_QUANTITY;
  // Loose vials the shop would sell with this pack (priceOrder), else none.
  const parsedExtra = Number.parseInt(sp.extra ?? "0", 10);
  const extraVials = Number.isFinite(parsedExtra) && priceOrder(bundle, quantity, parsedExtra) ? parsedExtra : 0;

  if (coins.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
        <h1 className="text-2xl">Cryptocurrency payment is unavailable</h1>
        <p className="measure mx-auto mt-3 text-base text-ink-soft">
          Card payment is still available on the main page.
        </p>
        <p className="mt-8">
          <Link href="/#buy" className="link">
            Back to the order page
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Suspense>
      <CheckoutForm coins={coins} bundleId={bundle.id} quantity={quantity} extraVials={extraVials} nowMs={Date.now()} />
    </Suspense>
  );
}
