import { deliveryQuote, type StorefrontView } from "@/lib/commerce/view";

/**
 * The delivery the home page's timetable describes, read from the storefront
 * view rather than typed into the copy, so the page says what the checkout
 * sells and nothing more: the catalogue's first option (the one the checkout
 * preselects), its carrier, its cutoff and whether every order ships at no
 * charge. Imports nothing but the view's helpers, so the buy section (a
 * client component) can use it too.
 */
export interface ServiceFacts {
  /** "Next day": the option's own label. */
  label: string;
  /** "Amazon Shipping". */
  carrier: string;
  /** "3pm": the option's order-by time (the view's own field), else null. */
  cutoff: string | null;
  /** "Next working day": the option's transit without its cutoff, capitalised. */
  arrives: string;
  /** The option's transit as the catalogue words it: "next working day if ordered by 3pm". */
  transit: string;
  /**
   * The preselected option costs nothing whatever the order is worth: it is
   * free at a basket of nothing, and a bigger basket only ever pays less.
   */
  included: boolean;
}

export function serviceFacts(view: StorefrontView): ServiceFacts | null {
  const option = view.delivery.options[0];
  if (!option) return null;
  const transit = option.transit.trim();
  // The cutoff is the view's own field. The transit names it at its end
  // ("... if ordered by 3pm"), which the timetable says in its own words,
  // so that clause is left off when it is there.
  const clause = option.cutoff ? ` if ordered by ${option.cutoff}` : "";
  const when = (clause && transit.endsWith(clause) ? transit.slice(0, -clause.length) : transit).trim();
  return {
    label: option.label,
    carrier: option.carrier,
    cutoff: option.cutoff,
    arrives: when ? `${when.charAt(0).toUpperCase()}${when.slice(1)}` : "",
    transit,
    included: deliveryQuote(view, 0)[0]?.priceMinor === 0,
  };
}
