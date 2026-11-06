/**
 * The product page's words, and the facts they state, built from the
 * storefront view (lib/commerce/view.ts) so they follow the catalogue: pack
 * sizes and codes, prices, the order limit, the delivery the packs ship
 * with and its cutoff. Nothing here is typed in that the catalogue, the
 * profile or the product's own description does not back, and an empty
 * value renders nothing.
 *
 * Imports the view's types and helpers only, so a client component may
 * read it too.
 *
 * Left out on purpose until they are true for this brand:
 *  - TODO(confirm): whether prices include VAT. The terms say nothing until
 *    the VAT statement is set; the trade grid says to ask, nothing more.
 *  - TODO(confirm): storage and shelf life once opened, carton sizes and
 *    packed weights, batch documents, certificates of analysis and a safety
 *    data sheet. None is published for this brand yet, so the Documents tab
 *    says so plainly.
 *  - TODO(launch): a VAT invoice, once a VAT number is configured. Until
 *    then nothing here offers one.
 */
import { deliveryQuote, formatGbp, packSavingMinor, type DeliveryOptionView, type PackView, type StorefrontView } from "@/lib/commerce/view";

/** "1,000". */
export const count = (n: number) => n.toLocaleString("en-GB");

/** "50 vials", "1 vial". */
export const vials = (n: number) => (n === 1 ? "1 vial" : `${count(n)} vials`);

/** "50 and 100", "250, 500 and 1,000". */
export function sizeList(sizes: readonly number[]): string {
  const words = sizes.map(count);
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export const onSale = (view: StorefrontView) => view.packs.filter((p) => p.available);
export const byQuote = (view: StorefrontView) => view.packs.filter((p) => !p.available);

/** The packs on sale, cheapest a vial first. */
const byPerVial = (view: StorefrontView) => [...onSale(view)].sort((a, b) => a.perVialMinor - b.perVialMinor);

// ── Delivery, from the view alone ───────────────────────────────────

/**
 * The delivery every pack on sale ships with: each option offered at the
 * smallest pack's value, at the price the checkout will charge. Every pack
 * here clears the free threshold, so this is what any online order gets.
 */
export function packDelivery(view: StorefrontView): { option: DeliveryOptionView; priceMinor: number }[] {
  const sale = onSale(view);
  if (sale.length === 0) return [];
  return deliveryQuote(view, Math.min(...sale.map((p) => p.priceMinor)));
}

/** "next working day": an option's transit without its cutoff clause. */
export function transitOnly(option: DeliveryOptionView): string {
  return option.cutoff ? option.transit.replace(new RegExp(`\\s*if ordered by ${option.cutoff}$`), "") : option.transit;
}

/** The option with a cutoff, if any is offered: the one the utility bar names. */
export function cutoffOption(view: StorefrontView): DeliveryOptionView | null {
  return packDelivery(view).find((d) => d.option.cutoff)?.option ?? null;
}

// ── The utility bar ─────────────────────────────────────────────────

type UtilityFact = { icon: "clock" | "truck" | "building"; text: string; short: string };

/**
 * The bar's facts, in order; a phone shows the first alone, in its `short`
 * form, which is the option's own transit sentence ("Next working day
 * delivery if ordered by 3pm").
 */
export function utilityFacts(view: StorefrontView): UtilityFact[] {
  const cut = cutoffOption(view);
  const transit = cut ? transitOnly(cut) : "";
  return [
    cut
      ? {
          icon: "clock" as const,
          text: `Order by ${cut.cutoff} on a working day for ${transit} delivery`,
          short: `${transit.charAt(0).toUpperCase()}${transit.slice(1)} delivery if ordered by ${cut.cutoff}`,
        }
      : null,
    { icon: "truck" as const, text: "Tracked delivery to UK addresses", short: "Tracked UK delivery" },
    { icon: "building" as const, text: "Trade and public orders welcome", short: "Trade and public orders welcome" },
  ].filter((f): f is UtilityFact => f !== null);
}

// ── The product block ───────────────────────────────────────────────

export const PRODUCT = {
  crumbs: { catalogue: "Catalogue", category: "Diluents", current: "Bacteriostatic water 10ml" },
  title: "Bacteriostatic water 10ml",
  /** The line under the title. */
  standfirst(view: StorefrontView): string {
    const sizes = view.packs.map((p) => p.vials);
    const range = sizes.length > 1 ? `in packs of ${count(Math.min(...sizes))} to ${count(Math.max(...sizes))} vials` : "by the pack";
    return `Sterile water with a bacteriostatic preservative, in a sealed 10ml glass vial. Sold ${range}, priced per vial.`;
  },
  codesLabel: "Pack codes",
  codeTitle: (p: PackView) => `${vials(p.vials)}${p.available ? "" : ", by quote"}`,
  /** The short spec beside the gallery. */
  summary: [
    { term: "Volume", detail: "10ml a vial" },
    { term: "Vial", detail: "Clear glass, sealed" },
    { term: "Closure", detail: "Blue flip-off cap over an aluminium crimp" },
    { term: "Supplied as", detail: "A laboratory reagent" },
  ],
  priceLabel: "Online price",
  /** "£3.50 a vial", the lowest rate online, and the pack it is for. */
  best(view: StorefrontView): { price: string; note: string } | null {
    const best = byPerVial(view)[0];
    return best ? { price: formatGbp(best.perVialMinor), note: `a vial, in packs of ${count(best.vials)}` } : null;
  },
  /** Every other online rate: "£4.00 a vial in packs of 50". */
  others(view: StorefrontView): string[] {
    return byPerVial(view)
      .slice(1)
      .map((p) => `${formatGbp(p.perVialMinor)} a vial in packs of ${count(p.vials)}`);
  },
  choose: "Choose quantities",
  quote: "Request a quote",
  /** The checks under the actions. Only facts the view or the terms back. */
  facts(view: StorefrontView): string[] {
    const d = packDelivery(view)[0];
    const quote = byQuote(view);
    return [
      d
        ? `${d.priceMinor === 0 ? "Free " : ""}${d.option.label.toLowerCase()} delivery by ${d.option.carrier}${d.option.cutoff ? `, ordered by ${d.option.cutoff} on a working day` : ""}`
        : "",
      `Up to ${vials(view.limits.maxVials)} in one online order`,
      quote.length > 0 ? `${sizeList(quote.map((p) => p.vials))} vials by quote` : "",
    ].filter(Boolean);
  },
};

// ── The tabbed specification ───────────────────────────────────────

export const TABS = {
  label: "Product information",
  spec: "Specification",
  packs: "Packs & cartons",
  delivery: "Delivery",
  documents: "Documents",
};

export interface Row {
  term: string;
  detail: string;
  link?: { href: string; text: string };
}

/**
 * The specification, in the words this brand's terms already publish
 * (lib/commerce/legal.ts) and the product's own description.
 * TODO(confirm): storage, shelf life, fill tolerance, stopper material.
 */
export const SPEC: { intro: string; rows: Row[] } = {
  intro: "The same vial in every pack. Only the number of vials and the carton change.",
  rows: [
    { term: "Product", detail: "Bacteriostatic water" },
    { term: "Contents", detail: "Sterile water with a bacteriostatic preservative" },
    { term: "Volume", detail: "10ml a vial" },
    { term: "Vial", detail: "Clear glass, sealed" },
    { term: "Closure", detail: "Royal blue flip-off cap over a silver aluminium crimp" },
    { term: "Label", detail: "Plain, unbranded" },
    { term: "Packing", detail: "A plain box with no branding on it" },
    { term: "Supplied as", detail: "A laboratory reagent: a sterile diluent and solvent for laboratory and research use" },
    { term: "Status", detail: "Not a medicine and not a medical device. No therapeutic claim is made." },
  ],
};

/** One row of the packs table: what each code is and how it is bought. */
export function packRows(view: StorefrontView): { sku: string; size: string; perVial: string; how: string; quote: boolean }[] {
  return view.packs.map((p) => ({
    sku: p.sku,
    size: vials(p.vials),
    perVial: p.available ? formatGbp(p.perVialMinor) : "On request",
    how: p.available ? "Online" : "By quote",
    quote: !p.available,
  }));
}

// The packing is a plain box with no branding (the owner, 6 Nov 2026), and
// the specification says so; nothing else about it is stated yet.
// TODO(confirm): carton sizes, packed weights and how the vials are held
// inside.
export const PACKS = {
  intro: "Each code is one pack of that many vials. The vial is the same in every pack.",
  head: { code: "Code", size: "Pack", perVial: "Per vial", how: "Ordered" },
  /** Why the larger packs are quoted, in procurement terms. */
  quoteNote(view: StorefrontView): string {
    const quote = byQuote(view);
    if (quote.length === 0) return "";
    return `Packs of ${sizeList(quote.map((p) => p.vials))} vials are heavier than the parcel services we book online carry, so we quote them with their delivery.`;
  },
};

export const DELIVERY_TAB = {
  intro: "Delivery to UK addresses only.",
  head: { service: "Service", carrier: "Carrier", when: "Arrives", price: "Price on online packs" },
  free: "Free",
  /** The dispatch line, from the cutoff. */
  cutoffLine: (cutoff: string, transit: string) => `Order by ${cutoff} on a working day for delivery the ${transit}.`,
  tracking: "Every parcel is tracked. We email the tracking number when it ships.",
  quoteLine: "Quoted packs are delivered by the service we quote with them.",
};

/**
 * What is published and what is not. Honest by design: a buyer's
 * procurement checklist asks for these, and the answer to the ones not yet
 * published is "not yet", never a promise.
 */
export const DOCUMENTS = {
  intro: "What we publish for this product today. Ask us about anything not listed.",
  available: [
    { name: "Terms of sale", href: "/terms" },
    { name: "Returns policy", href: "/returns" },
    { name: "Product disclaimer", href: "/disclaimer" },
    { name: "Privacy policy", href: "/privacy" },
  ],
  availableHead: "Published",
  pendingHead: "Not published yet",
  // TODO(confirm): a safety data sheet, a certificate of analysis and batch
  // documents. Each moves to `available` once it exists and is published.
  pending: ["Safety data sheet", "Certificate of analysis", "Batch documents"],
  pendingNote: "If you need one of these before you order, ask us and we will tell you what we can supply.",
  ask: "Ask about documents",
  orderLine: "Every order is confirmed by email, with its order number, lines and total.",
};

// ── The order ───────────────────────────────────────────────────────

export const MATRIX = {
  heading: "Pricing and order",
  lede: "Prices in pounds sterling. Type the number of packs you need; the summary totals the order as you go.",
  caption: "Price per pack and per vial, with the quantity to order",
  pack: "Pack",
  code: "Code",
  perVial: "Per vial",
  packPrice: "Pack price",
  saving: "Saving",
  quantity: "Packs",
  line: "Line total",
  baseRate: "Base rate",
  save: (minor: number) => `Save ${formatGbp(minor)}`,
  saveDetail: (base: number) => `against ${count(base)}-vial packs`,
  byQuote: "Priced on request, with delivery",
  requestQuote: "Request a quote",
  quantityLabel: (pack: PackView) => `Number of ${count(pack.vials)}-vial packs`,
  /** The notes under the table. */
  notes(view: StorefrontView): string[] {
    const base = onSale(view)[0];
    return [
      base ? `Savings compare the same number of vials bought in ${count(base.vials)}-vial packs.` : "",
      `One online order holds up to ${vials(view.limits.maxVials)}. For more, request a quote.`,
    ].filter(Boolean);
  },
  /** A typed quantity past what fits. */
  capped: (max: number, pack: PackView) =>
    max === 0 ? `No more ${count(pack.vials)}-vial packs fit this order.` : `Up to ${max} of this pack fit one online order.`,
};

/** A pack's saving against the base rate, in pence (0 for the base pack). */
export const savingFor = packSavingMinor;

// ── The quote band ──────────────────────────────────────────────────

export const QUOTE_BAND = {
  heading: "Larger volumes and standing orders",
  body(view: StorefrontView): string {
    const quote = byQuote(view);
    const sizes = quote.length > 0 ? `Packs of ${sizeList(quote.map((p) => p.vials))} vials are priced on request, with delivery quoted for the weight. ` : "";
    return `${sizes}For a recurring order, tell us how often and we price the schedule.`;
  },
  row: (n: number) => `${count(n)} vials`,
  rowAction: "Request a quote",
  standing: "Ask about a standing order",
};

// ── Trade information ──────────────────────────────────────────────

export const TRADE = { heading: "Trade information", lede: "What a buyer checks before raising an order." };

/** The grid's cells, from the view. Empty values are left out. */
export function tradeTerms(view: StorefrontView): Row[] {
  const sale = onSale(view);
  const quote = byQuote(view);
  const methods = view.payment.methods;
  const rows: (Row | null)[] = [
    {
      term: "Who can order",
      detail: "Businesses, laboratories and members of the public. There is no trade account to open and nothing to apply for.",
    },
    sale[0] ? { term: "Minimum order", detail: `One pack of ${vials(sale[0].vials)}.` } : null,
    {
      term: "Online order limit",
      detail: `${vials(view.limits.maxVials)} an order.${quote.length > 0 ? ` ${sizeList(quote.map((p) => p.vials))}-vial packs by quote.` : ""}`,
      link: quote.length > 0 ? { href: "/quote", text: "Request a quote" } : undefined,
    },
    methods.length > 0
      ? {
          term: "Payment",
          detail: `In full when you order, by ${methods.map((m) => m.label).join(" or ")}.${view.flags.businessDetails ? " Add your company name and VAT number to the order if you want them recorded." : ""}`,
        }
      : null,
    {
      term: "Returns from businesses",
      detail: "Only with our prior written agreement, and a restocking charge may apply.",
      link: { href: "/returns", text: "Returns policy" },
    },
    // TODO(confirm): whether prices include VAT. Say so here once it is set.
    { term: "VAT", detail: "The price shown is the price you pay at checkout. Ask us for VAT details before you order.", link: { href: "/contact", text: "Contact us" } },
  ];
  return rows.filter((r): r is Row => r !== null);
}
