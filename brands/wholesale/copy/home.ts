/**
 * The home page's words, and the facts they state, built from the
 * storefront view (lib/commerce/view.ts) so they follow the catalogue: pack
 * sizes, the order limit, the delivery the packs ship with. Nothing here is
 * typed in that the catalogue or the profile does not back, and an empty
 * value renders nothing.
 *
 * Imports the view's types and formatGbp only, so a client component may
 * read it too.
 *
 * Left out on purpose until they are true for this brand:
 *  - TODO(confirm): whether prices include VAT. The terms say nothing until
 *    the VAT statement is set, so neither does this page.
 *  - TODO(confirm): storage and shelf life once opened, batch documents and
 *    certificates. None is published for this brand yet.
 *  - TODO(launch): a printable VAT invoice page, once a VAT number is
 *    configured.
 */
import { deliveryQuote, formatGbp, type PackView, type StorefrontView } from "@/lib/commerce/view";

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

export const HERO = {
  title: "10ml bacteriostatic water, priced per vial",
  /** The lede under the title. */
  lede(view: StorefrontView): string {
    const sale = onSale(view);
    const quote = byQuote(view);
    const parts = [
      sale.length > 0 ? `Packs of ${sizeList(sale.map((p) => p.vials))} vials, ordered online by anyone. No trade account to open.` : "",
      quote.length > 0 ? `${sizeList(quote.map((p) => p.vials))} vials by quote.` : "",
    ];
    return parts.filter(Boolean).join(" ");
  },
};

export const PRICE_LIST = {
  caption: "Price list",
  captionDetail: "10ml vials, in pounds sterling",
  pack: "Pack",
  code: "Code",
  perVial: "Per vial",
  packPrice: "Pack price",
  quantity: "Quantity",
  baseRate: "Base rate",
  save: (minor: number) => `Save ${formatGbp(minor)}`,
  byQuote: "By quote",
  requestQuote: "Request a quote",
  /** The note under the table: what the saving is measured against, and the order limit. */
  notes(view: StorefrontView): string[] {
    const base = onSale(view)[0];
    return [
      base ? `Savings are against the same number of vials bought in ${count(base.vials)}-vial packs.` : "",
      `One online order holds up to ${vials(view.limits.maxVials)}.`,
    ].filter(Boolean);
  },
  quantityLabel: (pack: PackView) => `Quantity of ${count(pack.vials)}-vial packs`,
};

/** Every delivery the packs on sale are offered, priced at the smallest pack's value. */
export function packDelivery(view: StorefrontView): { line: string; free: boolean }[] {
  const sale = onSale(view);
  if (sale.length === 0) return [];
  const smallest = Math.min(...sale.map((p) => p.priceMinor));
  return deliveryQuote(view, smallest).map(({ option, priceMinor }) => ({
    line: `${option.label} by ${option.carrier}: ${option.transit}.`,
    free: priceMinor === 0,
  }));
}

export interface TermRow {
  term: string;
  detail: string;
  link?: { href: string; text: string };
}

/** "Ordering, delivery and payment": the trade terms as a procurement buyer reads them. */
export function orderingTerms(view: StorefrontView): TermRow[] {
  const sale = onSale(view);
  const quote = byQuote(view);
  const methods = view.payment.methods;
  const rows: (TermRow | null)[] = [
    { term: "Who can order", detail: "Anyone. There is no trade account to open and nothing to apply for." },
    sale[0] ? { term: "Minimum order", detail: `${vials(sale[0].vials)}, one pack.` } : null,
    { term: "Online order limit", detail: `${vials(view.limits.maxVials)} an order.` },
    quote.length > 0
      ? {
          term: "Larger volumes",
          detail: `${sizeList(quote.map((p) => p.vials))} vials, by quote.`,
          link: { href: "/quote", text: "Request a quote" },
        }
      : null,
    ...packDelivery(view).map((d) => ({
      term: "Delivery",
      detail: `${d.line}${d.free ? " Free on every online order." : ""}`,
    })),
    methods.length > 0
      ? { term: "Payment", detail: `In full when you order, by ${methods.map((m) => m.label).join(" or ")}.` }
      : null,
    view.flags.businessDetails
      ? { term: "Company and VAT number", detail: "Optional. Give them when you order and we record them against it." }
      : null,
    {
      term: "Returns from businesses",
      detail: "Only with our prior written agreement, and a restocking charge may apply.",
      link: { href: "/returns", text: "Returns policy" },
    },
  ];
  return rows.filter((r): r is TermRow => r !== null);
}

export const ORDERING = { heading: "Ordering, delivery and payment" };

/**
 * The product, in the words this brand's terms already publish
 * (lib/commerce/legal.ts): sterile water with a bacteriostatic
 * preservative, in a sealed 10ml vial, supplied as a laboratory reagent.
 */
export const SPEC = {
  heading: "Product specification",
  rows: [
    { term: "Product", detail: "Bacteriostatic water" },
    { term: "Vial", detail: "10ml, sealed" },
    { term: "Contents", detail: "Sterile water with a bacteriostatic preservative" },
    { term: "Supplied as", detail: "A laboratory reagent: a sterile diluent and solvent for laboratory and research use" },
    { term: "Status", detail: "Not a medicine and not a medical device. No therapeutic claim is made." },
  ] as TermRow[],
  codesTerm: "Pack codes",
};

export const QUOTE_BAND = {
  heading: (view: StorefrontView) => {
    const first = byQuote(view)[0];
    return first ? `${vials(first.vials)} or more` : "Larger volumes";
  },
  body: (view: StorefrontView) => {
    const quote = byQuote(view);
    const sizes = quote.length > 0 ? `Packs of ${sizeList(quote.map((p) => p.vials))} vials are sold by quote. ` : "";
    return `${sizes}Send the quantity, the delivery postcode and whether the order is a one-off or recurring, and we reply by email.`;
  },
  action: "Request a quote",
};
