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
  /** "3pm" when the option names a cutoff ("... if ordered by 3pm"), else null. */
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

const CUTOFF = /\bby\s+(\d{1,2}(?:[:.]\d{2})?\s?[ap]m)\b/i;

export function serviceFacts(view: StorefrontView): ServiceFacts | null {
  const option = view.delivery.options[0];
  if (!option) return null;
  const transit = option.transit.trim();
  const when = transit.replace(/\s+if\s+ordered\s+by\s+.*$/i, "").trim();
  return {
    label: option.label,
    carrier: option.carrier,
    cutoff: CUTOFF.exec(transit)?.[1] ?? null,
    arrives: when ? `${when.charAt(0).toUpperCase()}${when.slice(1)}` : "",
    transit,
    included: deliveryQuote(view, 0)[0]?.priceMinor === 0,
  };
}
