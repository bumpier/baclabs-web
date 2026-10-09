"use client";

import Link from "next/link";
import { DELIVERY, type Bundle } from "@/config/funnel";
import { packByBundleId, packPath } from "@/config/products";
import { formatCutoffHour } from "@/lib/delivery-date";
import { upsellCopy, upsellFor } from "@/lib/upsell";
import { useFunnel } from "@/components/funnel/FunnelState";
import { PaymentMarks } from "@/components/funnel/PaymentMarks";
import { WelcomeVialPanel } from "@/components/mailing-list/WelcomeVialPanel";
import { CheckMark, CheckoutRow, DeliveryLine, PriceLine } from "@/components/funnel/buy/parts";

/**
 * The purchase panel on a pack page.
 *
 * DELIBERATELY NOT components/funnel/buy/BuyBoxPills, which is the home
 * page's block. That one offers every amount as a pill, which is right for the
 * page a visitor lands on and wrong here: a /products page that offers every
 * other tier inside it is every page selling the same things, which is
 * the duplication these pages exist to avoid. On a pack page the tier is the
 * SUBJECT, so choosing a different one means following a link — which is also
 * what gives the pack pages a reason to link to one another.
 *
 * So this panel sells exactly one tier. Quantity is a multiple of THIS pack.
 * It is built from the home page's parts, so it says the same things the
 * same way: the price once, how far it is from free delivery, the step up
 * to the next pack, the total on the button, the trust line, and the
 * mailing-list signup open. No totals table and no
 * tinted boxes: that was the "muddy" panel both pages used to carry.
 */
export function PackBuy({
  bundle,
  cryptoEnabled,
  otherPacksHref,
}: {
  bundle: Bundle;
  cryptoEnabled: boolean;
  /** Where "a different quantity" goes — the /products index. */
  otherPacksHref: string;
}) {
  // The provider is mounted with this pack's tier, so `bundle` here and the
  // context agree. Quantity is the only thing the customer changes.
  const { quantity, extraVials, vials, setExtraVials } = useFunnel();
  // The step up to the next pack, as the home page offers it (lib/upsell.ts).
  // A top-up keeps this pack, so it is a button rather than a link away.
  const offer = upsellFor(bundle, quantity, extraVials);
  const offerPage = offer && offer.kind !== "top-up" ? packByBundleId(offer.to.bundle.id) : undefined;

  // No "Cheapest in the UK" here: that claim lives only on the home page,
  // beside the guarantee that substantiates it.
  const checks = [
    DELIVERY.dispatchLine ? `Same working day dispatch, order by ${formatCutoffHour()}` : "",
    "Secure checkout by Stripe",
  ].filter(Boolean);

  return (
    <div className="panel p-5 sm:p-6">
      {bundle.id === "five" ? (
        <p className="mb-3">
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">Most popular</span>
        </p>
      ) : null}
      <PriceLine />
      <DeliveryLine className="mt-5" />

      {/* The step up to the next pack. A link, not a switch: on a pack page
          the pack is the subject. The checkout button offers the same step
          once more, and pays for it directly. */}
      {offer && (offerPage || offer.kind === "top-up") ? (
        <p className="mt-4 rounded-control bg-brand-tint px-3 py-2 text-sm text-brand-deep">
          {upsellCopy(offer).line}{" "}
          {offerPage ? (
            <Link href={packPath(offerPage)} className="font-semibold underline underline-offset-4">
              See the {offer.to.vials}-vial pack
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setExtraVials(offer.to.extraVials)}
              className="font-semibold underline underline-offset-4"
            >
              {upsellCopy(offer).accept}
            </button>
          )}
        </p>
      ) : null}

      <div className="mt-5">
        <CheckoutRow cryptoEnabled={cryptoEnabled} />
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {checks.map((label) => (
          <li key={label} className="flex items-center gap-2 text-sm text-ink-soft">
            <CheckMark />
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <PaymentMarks />
      </div>

      {/* The way to a different quantity is a link, not a control. */}
      <p className="mt-4 text-sm">
        <Link href={otherPacksHref} className="link">
          Need a different quantity?
        </Link>
      </p>

      <div className="mt-5">
        <WelcomeVialPanel vials={vials} compact />
      </div>
    </div>
  );
}
