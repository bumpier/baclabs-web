/**
 * The legal pages of every brand but BacLab: terms, privacy notice, returns
 * and the product disclaimer, written from the brand's profile and catalogue
 * as data (lib/commerce/legal-doc.ts) for components/commerce/LegalPage.tsx.
 *
 * The wording is BacLab's (app/(baclab)/(store)/{terms,privacy,returns,
 * disclaimer}), which stays exactly as it is, with what does not apply to a
 * brand left out: no crypto, no monthly plans, no welcome vial, and no
 * mailing list for a brand that runs none. What differs comes from the brand:
 *  - the party: its registered name, or its own name until one is set, and
 *    "a trading name of" once one is;
 *  - its contact address, or the contact page while it has none;
 *  - how it takes payment and who processes it (BrandProfile.payment). Until
 *    that is set the wording names no method and no provider: the brands'
 *    payment methods are still being decided (TODO(payments));
 *  - its delivery options and free-delivery threshold, from its catalogue;
 *  - the trackers its site runs, read per request for the privacy notice.
 *
 * The house rules hold here as everywhere: no medical, injection or dosing
 * framing; the preservative is "a bacteriostatic preservative" and nothing
 * more; and each brand's own words (lib/content-rules.ts brandRules) are
 * respected by every brand's text, so the wording avoids, for example,
 * "sale" (luxury) and "procedure" (beauty). npm run test:kit runs
 * checkBrandCopy over all four brands' documents.
 *
 * Statutory references are to the law of England and Wales. Like BacLab's,
 * this wording must be read by a solicitor before a brand takes a real
 * order, the sealed-goods exception in /returns above all.
 *
 * SERVER CODE: it reads config/funnel.ts, lib/legal.ts and settings.
 */
import type { BrandProfile } from "@/brands/types";
import { DELIVERY, PRODUCT, VAT } from "@/config/funnel";
import { COMPLAINT_ACK_DAYS, DAMAGE_REPORT_DAYS, RECORD_RETENTION_YEARS, RETURNS_ADDRESS } from "@/lib/legal";
import { getBrandMetaPixelId } from "@/lib/settings";
import { capiAccessToken } from "@/lib/meta-capi";
import { catalogueDeliveryOptions } from "@/lib/commerce/catalogue";
import { formatGbp } from "@/lib/commerce/view";
import {
  legalAnchor,
  type LegalBlock,
  type LegalDoc,
  type LegalIdentity,
  type LegalInline,
  type LegalSection,
} from "@/lib/commerce/legal-doc";

/**
 * Bump this whenever the wording of any brand's legal page changes. It is
 * printed on every one of them, and a stale date asserts a review that did
 * not happen. (BacLab's own date is lib/legal.ts LEGAL_LAST_UPDATED.)
 */
export const BRAND_LEGAL_LAST_UPDATED = "4 November 2026";

// ── Building blocks ────────────────────────────────────────────────

const p = (...content: LegalInline[]): LegalBlock => ({ kind: "p", content });
const h3 = (text: string): LegalBlock => ({ kind: "h3", text });
const ul = (...items: LegalInline[][]): LegalBlock => ({ kind: "ul", items });
const ol = (...items: LegalInline[][]): LegalBlock => ({ kind: "ol", items });
const dl = (...items: [term: string, detail: LegalInline[]][]): LegalBlock => ({
  kind: "dl",
  items: items.map(([term, detail]) => ({ term, detail })),
});
const b = (strong: string): LegalInline => ({ strong });
const a = (href: string, text: string): LegalInline => ({ href, text });

/**
 * A section, written once it is known which clause number every heading
 * has: `clause("Our liability to you")` is "clause 11" in a document where it
 * is the eleventh. `when: false` leaves it out, and the numbers close up.
 */
interface SectionDef {
  heading: string;
  when?: boolean;
  blocks: (clause: (heading: string) => string) => LegalBlock[];
}

function legalDoc(meta: Omit<LegalDoc, "sections" | "lastUpdated">, defs: SectionDef[]): LegalDoc {
  const kept = defs.filter((d) => d.when !== false);
  const clause = (heading: string) => {
    const i = kept.findIndex((d) => d.heading === heading);
    if (i < 0) throw new Error(`legal: no clause "${heading}" in ${meta.path}`);
    return `clause ${i + 1}`;
  };
  const sections: LegalSection[] = kept.map((d) => ({ id: legalAnchor(d.heading), heading: d.heading, blocks: d.blocks(clause) }));
  return { ...meta, lastUpdated: BRAND_LEGAL_LAST_UPDATED, sections };
}

// ── Facts from the brand ───────────────────────────────────────────

/** The party to the contract: the registered name, or the brand's own until one is set. */
function party(brand: BrandProfile): string {
  return brand.legalName || brand.name;
}

/** Who "we" are, for LegalPage. Questions go to the support address, or the contact page. */
export function legalIdentity(brand: BrandProfile): LegalIdentity {
  return { name: brand.name, party: party(brand), contactEmail: brand.email.contact || null };
}

/** The support address as a link, or the contact page while there is none. */
function contactLine(brand: BrandProfile, address: string = brand.email.contact): LegalInline {
  return address ? a(`mailto:${address}`, address) : a("/contact", "our contact page");
}

/** A trade site: business buyers, resale expected, business details asked for at payment. */
function isTrade(brand: BrandProfile): boolean {
  return brand.catalogue?.collectBusinessDetails === true;
}

/** "Sterile water with a bacteriostatic preservative, in a sealed 10ml vial." */
function productLine(): string {
  // Not PRODUCT.composition: its "multi-dose" is the pharmacopoeial term,
  // but the gym brand's rules ban every form of "dose", so the brands'
  // pages describe the vial without it.
  return `Sterile water with a bacteriostatic preservative, in a sealed ${PRODUCT.size}.`;
}

function productUse(): string {
  return PRODUCT.use.charAt(0).toLowerCase() + PRODUCT.use.slice(1);
}

/** Each delivery option the catalogue offers, with what it costs below and above the threshold. */
function deliveryItems(brand: BrandProfile): LegalInline[][] {
  const catalogue = brand.catalogue;
  if (!catalogue) return [];
  const from = catalogue.delivery.freeFromMinor;
  // Priced as the checkout prices them, just under and at the threshold.
  const below = from === null || from > 0 ? catalogueDeliveryOptions(catalogue, Math.max(0, (from ?? 1) - 1)) : [];
  const over = from === null ? [] : catalogueDeliveryOptions(catalogue, from);
  return catalogue.delivery.options.map((option) => {
    const under = below.find((o) => o.option.id === option.id);
    const above = over.find((o) => o.option.id === option.id);
    const price = (minor: number) => (minor === 0 ? "free" : formatGbp(minor));
    let cost: string;
    if (from === 0) cost = above ? `${price(above.priceMinor)} on every order` : "not offered";
    else if (from === null || !under) cost = under ? price(under.priceMinor) : "not offered";
    else if (!above) cost = `${price(under.priceMinor)}, on orders under ${formatGbp(from)}`;
    else if (above.priceMinor === under.priceMinor) cost = price(under.priceMinor);
    else cost = `${price(under.priceMinor)}, or ${price(above.priceMinor)} on orders of ${formatGbp(from)} or more`;
    return [b(option.label), `: ${option.carrier}, ${option.transit}. ${cost.charAt(0).toUpperCase()}${cost.slice(1)}.`];
  });
}

/** "a", "a and b", "a, b and c". */
function listOf(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Packs the catalogue lists but does not sell online: quote only. */
function quoteOnlyPacks(brand: BrandProfile): number[] {
  return (brand.catalogue?.packs ?? []).filter((p) => !p.available).map((p) => p.vials);
}

/** The company's details, each only when set. */
function companyRows(brand: BrandProfile, opts: { vat: boolean; ico: boolean }): [string, LegalInline[]][] {
  const c = brand.company ?? {};
  const rows: [string, LegalInline[]][] = [];
  if (brand.legalName) rows.push(["Registered name", [brand.legalName]]);
  if (c.number) rows.push(["Company number", [`Registered in England & Wales, no. ${c.number}`]]);
  if (c.registeredAddress) rows.push(["Registered office", [c.registeredAddress]]);
  if (opts.vat && c.vatNumber) rows.push(["VAT number", [c.vatNumber]]);
  if (opts.ico && c.icoRegistration) rows.push(["ICO registration", [c.icoRegistration]]);
  return rows;
}

/** "Aurelle is a trading name of X Ltd." once a registered name differs from the brand's. */
function tradingName(brand: BrandProfile): LegalBlock[] {
  return brand.legalName && brand.legalName !== brand.name ? [p(`${brand.name} is a trading name of ${brand.legalName}.`)] : [];
}

// ── Terms ──────────────────────────────────────────────────────────

export function brandTerms(brand: BrandProfile): LegalDoc {
  const catalogue = brand.catalogue;
  const trade = isTrade(brand);
  const inbox = brand.email.inbox;
  const quote = quoteOnlyPacks(brand);
  const maxVials = catalogue?.maxVials ?? 0;
  const methods = brand.payment?.methods ?? [];

  return legalDoc(
    {
      path: "/terms",
      title: "Terms and conditions",
      description: "The terms on which we supply our products, and the terms of use of this site.",
      intro: "The terms on which we supply you, and the terms on which you may use this website.",
    },
    [
      {
        heading: "About us and these terms",
        blocks: () => [
          p(
            "These terms and conditions (the ",
            b("“Terms”"),
            `) set out the basis on which ${party(brand)} (`,
            b("“we”"),
            ", ",
            b("“us”"),
            ", ",
            b("“our”"),
            ") supplies the products listed on this website (the ",
            b("“Site”"),
            ") to you. They apply to every order you place, to the exclusion of any other terms you seek to impose."
          ),
          p(
            "By placing an order you confirm that you have read, understood and accept these Terms and the ",
            a("/disclaimer", "product disclaimer"),
            ". Please save or print a copy for your records; we do not file a copy of the contract on your behalf. These Terms are available only in English, and the contract will be concluded in English."
          ),
          ...tradingName(brand),
          h3("Our details"),
          dl(...companyRows(brand, { vat: true, ico: false }), [
            "Contact",
            inbox
              ? [a(`mailto:${inbox}`, inbox), ", or see our ", a("/contact", "contact page"), "."]
              : ["See our ", a("/contact", "contact page"), "."],
          ]),
        ],
      },
      {
        heading: "Eligibility to order",
        blocks: (clause) => [
          p("By placing an order you represent and warrant that:"),
          ul(
            ["you are at least 18 years old and have legal capacity to enter a contract;"],
            [
              "where you order on behalf of a business or institution, you are authorised to bind it, and it, not you, is our customer;",
            ],
            ["the information you give us, including your name and delivery address, is accurate and complete; and"],
            [
              `you will use the product only as described in ${clause("What the product is, and what it is not")} and in the `,
              a("/disclaimer", "product disclaimer"),
              ".",
            ]
          ),
          p(
            "We do not knowingly supply anyone under 18. We may refuse, limit or cancel any order at our discretion, including where we have reasonable grounds to believe an order is fraudulent",
            trade ? "" : ", is for resale without our consent",
            ", or is intended for a use we do not supply the product for."
          ),
        ],
      },
      {
        heading: "What the product is, and what it is not",
        blocks: () => [
          p(`We supply ${PRODUCT.name} in a ${PRODUCT.size}. ${productLine()} It is supplied as a laboratory reagent: ${productUse()}`),
          p(
            b("The product is not a medicine and is not a medical device."),
            " It is not authorised under the Human Medicines Regulations 2012, is not CE or UKCA marked under the Medical Devices Regulations 2002, and is not a food, cosmetic or supplement. We make no therapeutic, diagnostic, preventative or nutritional claim of any kind, and nothing on the Site should be read as one."
          ),
          p(
            "You are solely responsible for determining whether the product is suitable for your intended purpose, for the competence of the people who handle it, and for complying with every law, regulation, licence and institutional rule that applies to your use of it. If you are in any doubt, do not order. The full position is set out in the ",
            a("/disclaimer", "product disclaimer"),
            ", which forms part of these Terms."
          ),
        ],
      },
      {
        heading: "How a contract is formed",
        blocks: () => [
          ol(
            ["The listings on the Site are an invitation to treat. They are not an offer and we are not obliged to accept any order."],
            ["Your order is an offer to buy on these Terms. You can review and correct it before you pay."],
            ["Any acknowledgement we send confirms that we have received your order. It is not acceptance of it."],
            [
              "The contract is formed only when we send you a dispatch confirmation. Until then no contract exists between us, whether or not payment has been taken.",
            ],
            [
              "If we cannot accept your order, because the product is out of stock, because a price or description was wrong, because we could not authorise payment, or for any other reason, we will tell you and refund any sum paid in full. That refund is the limit of our liability in those circumstances.",
            ]
          ),
          p(
            `A single order may hold no more than ${maxVials} vials.`,
            quote.length > 0 ? ` Packs of ${listOf(quote.map((n) => n.toLocaleString("en-GB")))} vials are supplied on quotation only.` : "",
            " For larger volumes, please ",
            a("/contact", "contact us"),
            " before ordering."
          ),
        ],
      },
      {
        heading: "Price and payment",
        blocks: () => [
          p(
            "Prices are in pounds sterling and are those displayed on the Site at the time you place your order. Any charge additional to the product price, delivery included, is shown to you before you pay; you will never be charged a sum you have not seen first."
          ),
          ...(VAT.statement ? [p(VAT.statement)] : []),
          // TODO(payments): each method's own sentence comes from
          // BrandProfile.payment.methods. Until they are set, the clause
          // names no method and no provider.
          ...(methods.length > 0
            ? [
                p("Payment is due in full when you place your order, by one of these methods:"),
                ul(...methods.map((m): LegalInline[] => [b(m.label), `: ${m.terms}`])),
              ]
            : [p("Payment is due in full when you place your order, by one of the payment methods shown at checkout.")]),
          p("If a payment is declined, fails or does not reach us, we cannot complete the order."),
          ...(trade
            ? [p("If you buy for a business, you can give us your company name and VAT number with your order, and we record them against it.")]
            : []),
          p(
            "We take reasonable care over pricing, but errors occur. If the correct price at the date of your order is higher than the price stated, we will contact you for instructions before dispatching. If a pricing error is obvious and could reasonably have been recognised by you as a mis-pricing, we may cancel the order, refund you in full, and no contract will arise."
          ),
        ],
      },
      {
        heading: "Delivery",
        blocks: () => [
          p("We deliver to addresses in the United Kingdom only. You choose how your order is sent when you order, from:"),
          ul(...deliveryItems(brand)),
          p(DELIVERY.dispatchLine),
        ],
      },
      {
        heading: "Risk and ownership",
        blocks: () => [
          p(
            "Risk in the product passes to you when it is delivered to the address you gave us, or to a person you nominated to take delivery. Ownership passes when we have received payment in full."
          ),
          p(
            "Unless we agree a longer period with you, we will pass the product to the carrier without undue delay and in any event within 30 days of the date the contract is formed, as required by the Consumer Rights Act 2015. If we do not, you may treat the contract as at an end and we will refund you in full."
          ),
          p(
            "Once the product has been delivered, storing and handling it correctly is your responsibility. We are not liable for deterioration caused by storage or handling after delivery."
          ),
        ],
      },
      {
        heading: "Cancellation, returns and refunds",
        blocks: () => [
          p(
            "If you are a consumer you have a statutory right to cancel a distance contract under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, and separate statutory remedies under the Consumer Rights Act 2015 if the product is faulty, damaged or not as described."
          ),
          p(
            "How to exercise those rights, the exception we rely on for sealed goods, and how and when we refund, are set out in full in our ",
            a("/returns", "returns and refunds policy"),
            ", which forms part of these Terms. Nothing in these Terms or in that policy limits your statutory rights."
          ),
        ],
      },
      {
        heading: "Your obligations and acceptable use",
        blocks: () => [
          p("You agree that you will not:"),
          ul(
            ["administer the product to any human or animal, or supply it to anyone you know or suspect intends to do so;"],
            [
              "represent, in any forum, that the product is a medicine, a medical device, or suitable for any therapeutic, diagnostic or clinical purpose;",
            ],
            trade
              ? [
                  "supply the product to anyone except in its original sealed packaging and labelling, and on the same basis as we supply it, a laboratory reagent, or in breach of any law that applies to you;",
                ]
              : [
                  "resell, repackage, relabel, decant or otherwise distribute the product without our prior written consent, or in breach of any law that applies to you;",
                ],
            ["use the product for any unlawful purpose, or in breach of any licence or permit;"],
            ["remove, obscure or alter any labelling, batch identifier, expiry marking or safety information; or"],
            [
              "fail to store, handle and dispose of the product and its packaging in accordance with the product labelling and applicable waste rules.",
            ]
          ),
          p(
            "If you are a business customer, you indemnify us against all liabilities, costs and reasonable legal fees we incur arising from your breach of this clause. This indemnity does not apply to consumers."
          ),
        ],
      },
      {
        heading: "Use of this website",
        blocks: () => [
          p(
            `We grant you a limited, revocable, non-exclusive licence to view the Site for the purpose of considering and placing an order. All content on the Site (text, layout, graphics, photography, the ${brand.name} name and logo) is owned by us or our licensors and is protected by copyright and trade mark law. You may not reproduce, republish or exploit it commercially without our written consent.`
          ),
          p("You must not:"),
          ul(
            ["scrape, harvest, systematically download or mirror any part of the Site, or use it to build any product, dataset or model;"],
            ["attempt to gain unauthorised access to the Site, its servers, or any account, or introduce any malicious code; or"],
            ["interfere with the availability of the Site, including by any denial-of-service or automated request flooding."]
          ),
          p(
            "Content on the Site is general information about what we supply. It is not scientific, medical, legal or professional advice, and must not be relied on as such. We may change, suspend or withdraw the Site, or any part of it, without notice."
          ),
        ],
      },
      {
        heading: "Our liability to you",
        blocks: (clause) => [
          p(
            b("Nothing in these Terms excludes or limits our liability"),
            " for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, for defective products under Part I of the Consumer Protection Act 1987, or for any other liability that cannot lawfully be excluded or limited."
          ),
          h3("If you are a consumer"),
          p(
            "We are responsible for loss or damage you suffer that is a foreseeable result of our breach of these Terms or our failure to use reasonable care and skill. Loss or damage is foreseeable if it is obvious that it will happen, or if it was contemplated by both of us at the time the contract was formed. We are not responsible for unforeseeable loss or damage, nor for any business loss: if you use the product for any commercial, business or resale purpose we have no liability to you as a consumer for loss of profit, loss of business, business interruption or loss of business opportunity."
          ),
          h3("If you are a business customer"),
          p(
            "Subject to the paragraph above, our total liability to you arising under or in connection with a contract, whether in contract, tort (including negligence), breach of statutory duty or otherwise, is limited to the price you paid for the products giving rise to the claim. We are not liable for loss of profit, loss of revenue or business, loss of or corruption of data, loss of anticipated savings, loss of goodwill, or any indirect or consequential loss."
          ),
          h3("Use outside the intended purpose"),
          p(
            `We accept no liability of any kind for loss, injury or damage arising from use of the product otherwise than as described in ${clause("What the product is, and what it is not")} and the `,
            a("/disclaimer", "product disclaimer"),
            ", including, without limitation, any administration of the product to a human or an animal."
          ),
        ],
      },
      {
        heading: "Events outside our control",
        blocks: () => [
          p(
            "We are not liable for any failure or delay in performing our obligations where that failure or delay results from an event beyond our reasonable control, including carrier failure or industrial action, supplier or manufacturer failure, epidemic, flood, fire, extreme weather, act of terrorism, war, failure of public or private telecommunications networks, or an act or restriction of any government or public authority. If such an event occurs we will contact you as soon as we can. If it continues for more than 30 days, either of us may cancel the affected order and we will refund you in full."
          ),
        ],
      },
      {
        heading: "Complaints and disputes",
        blocks: () => [
          p(
            "If something has gone wrong, please tell us first: most problems are resolved quickly. Contact details are on our ",
            a("/contact", "contact page"),
            `. We aim to acknowledge every complaint within ${COMPLAINT_ACK_DAYS} working days and to resolve it within 14 days, telling you if it will take longer and why.`
          ),
          p(
            "If we cannot resolve your complaint between us, you may be able to refer it to an alternative dispute resolution provider, or to take court proceedings. We are not obliged to use, and do not currently subscribe to, any ADR scheme. Referring a complaint to ADR does not affect your right to bring a claim in court."
          ),
        ],
      },
      {
        heading: "Data protection",
        blocks: () => [
          p(
            "We use the personal information you give us to process your order, to take payment, to deliver the product, and to meet our record-keeping obligations. How we do that, the lawful bases we rely on, who we share the information with, and the rights you have over it, are set out in our ",
            a("/privacy", "privacy policy"),
            "."
          ),
        ],
      },
      {
        heading: "Changes to these terms",
        blocks: () => [
          p(
            "We may amend these Terms from time to time. The version that applies to your order is the version published on the Site at the moment you place it, so an amendment never changes the terms of an order you have already placed. Please re-read this page before each order."
          ),
        ],
      },
      {
        heading: "General",
        blocks: () => [
          ol(
            [
              b("Entire agreement."),
              " These Terms, together with the pages they expressly incorporate, are the entire agreement between us in relation to their subject matter, and replace any earlier statement or understanding. Nothing in this clause limits liability for fraudulent misrepresentation.",
            ],
            [b("Severance."), " If any provision is found to be unlawful or unenforceable, it is severed and the remaining provisions continue in force."],
            [
              b("No waiver."),
              " A delay in enforcing any provision is not a waiver of it, and does not prevent us enforcing it, or any other provision, later.",
            ],
            [
              b("Assignment."),
              " We may transfer our rights and obligations to another organisation, and will tell you in writing if we do; your rights under the contract will not be affected. You may not transfer your rights or obligations without our written consent.",
            ],
            [
              b("Third parties."),
              " A person who is not a party to the contract has no right under the Contracts (Rights of Third Parties) Act 1999 to enforce any of its terms.",
            ],
            [
              b("Notices."),
              " Notices under these Terms may be given by email to the address you supplied at checkout, or to our contact address, and are treated as received on the next working day after sending.",
            ]
          ),
        ],
      },
      {
        heading: "Governing law and jurisdiction",
        blocks: () => [
          p(
            "These Terms, their subject matter and their formation are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction. If you are a consumer living in Scotland or Northern Ireland, you may also bring proceedings in the courts of the country in which you live, and the mandatory consumer protection law of that country continues to apply to you."
          ),
        ],
      },
    ]
  );
}

// ── Returns ────────────────────────────────────────────────────────

export function brandReturns(brand: BrandProfile): LegalDoc {
  const contact = contactLine(brand);
  const hasStandard = brand.catalogue?.delivery.options.some((o) => o.id === "standard") ?? false;
  const refundMethods = (brand.payment?.methods ?? []).filter((m) => m.refunds);

  return legalDoc(
    {
      path: "/returns",
      title: "Returns and refunds",
      description: "Your right to cancel, how to return an order, and how refunds are handled.",
      intro: "How to cancel an order, what happens if something arrives damaged, and how we refund you.",
    },
    [
      {
        heading: "Your right to cancel",
        blocks: (clause) => [
          p(
            "If you are a consumer, the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 give you the right to cancel a distance contract within ",
            b("14 days"),
            ", without giving any reason."
          ),
          p(
            "The cancellation period ends 14 days after the day on which you, or a person you nominated other than the carrier, take physical possession of the goods. Where an order is delivered in more than one consignment, it ends 14 days after the day you receive the last consignment."
          ),
          p(
            `This right is separate from, and in addition to, your rights if something is faulty: see ${clause("Faulty, damaged or incorrect items")}.`
          ),
        ],
      },
      {
        heading: "The exception for sealed goods",
        blocks: (clause) => [
          p(
            "Each vial is supplied ",
            b("sealed for health protection and hygiene reasons"),
            ". Under regulation 28(3)(b) of those Regulations, the right to cancel does not apply to goods sealed for health protection or hygiene reasons which have been unsealed after delivery."
          ),
          p(
            "In practice this means: ",
            b("a vial whose seal is intact may be returned"),
            ` under ${clause("Your right to cancel")}; `,
            b("a vial that has been opened, punctured, or whose tamper-evident seal has been broken cannot be"),
            ", and we cannot refund it. We cannot verify the sterility of a vial that has left our control and been unsealed, and we will not supply one again."
          ),
          p(
            "This exception does not affect your rights if the product is faulty, damaged, or not as described. Those rights apply whether or not the vial has been opened."
          ),
        ],
      },
      {
        heading: "How to cancel, and returning the goods",
        blocks: () => [
          p(
            "To cancel, tell us clearly before the 14-day period ends. Email ",
            contact,
            " with your order number, your name, your address, and a statement that you are cancelling. A phone call or an ambiguous message is not enough: put it in writing so both of us have a record of the date. You may use the model cancellation form in Schedule 3 of the Regulations, but you do not have to."
          ),
          ...(RETURNS_ADDRESS
            ? [
                p(
                  "After telling us, send the goods back ",
                  b("within 14 days"),
                  ", unopened, with seals intact, and in their original packaging where possible. Send them to:"
                ),
                p(RETURNS_ADDRESS),
              ]
            : [
                p(
                  "After telling us, send the goods back ",
                  b("within 14 days"),
                  ", unopened, with seals intact, and in their original packaging where possible. We will confirm the return address in writing when we acknowledge your cancellation, and the 14 days run from the day we give it to you. Please wait for it rather than sending the parcel to any other address."
                ),
              ]),
          p(
            b("You pay the cost of returning the goods"),
            ", and you are responsible for them until we receive them. We recommend a tracked service and keeping proof of postage; without it, we may be unable to refund a parcel that does not arrive. You are liable for any reduction in the value of the goods caused by handling them beyond what is necessary to establish their nature and characteristics, and we may deduct that amount from your refund."
          ),
        ],
      },
      {
        heading: "Faulty, damaged or incorrect items",
        blocks: () => [
          p(
            "Under the Consumer Rights Act 2015 the goods we supply must be of satisfactory quality, fit for purpose and as described. If they are not, you have the right to:"
          ),
          ul(
            [b("reject them and get a full refund"), " within 30 days of delivery (the short-term right to reject);"],
            ["a ", b("repair or replacement"), " after those 30 days; and"],
            [
              "a ",
              b("refund, in whole or in part"),
              ", if a repair or replacement is unsuccessful, or cannot be provided within a reasonable time and without significant inconvenience to you.",
            ]
          ),
          p(
            `If your order arrives damaged, incomplete, or is not what you ordered, tell us within ${DAMAGE_REPORT_DAYS} days of delivery. Please include your order number, a description of the problem, and photographs of the item and its outer packaging, including any damage to the box, which is what we need to raise a claim with the carrier. Do not discard the packaging until the claim is settled.`
          ),
          p(
            `We will not ask you to return a broken or leaking vial where doing so is impractical or unsafe. Reporting after ${DAMAGE_REPORT_DAYS} days does not remove your statutory rights, but it may make a transit-damage claim harder to evidence.`
          ),
        ],
      },
      {
        heading: "Orders that do not arrive",
        blocks: () => [
          p(
            "If your order has not arrived, contact us and we will investigate with the carrier. If the goods are lost in transit they remain at our risk, and we will resend or refund at your choice. Where the carrier records a delivery that you did not receive, we will raise the matter with them; that process can take up to 14 days and we will keep you updated. Deliveries that fail because the address you supplied was wrong or incomplete, or because the parcel went unclaimed, are not our responsibility, though we will always try to help."
          ),
        ],
      },
      {
        heading: "How and when we refund",
        blocks: (clause) => [
          p(
            `Where you have cancelled under ${clause("Your right to cancel")}, we refund within `,
            b("14 days"),
            " of the day we receive the goods back, or of the day you supply evidence of having sent them, whichever is earlier. Where you have not yet received the goods, we refund within 14 days of the day you told us you were cancelling. Refunds for faulty goods are made without undue delay once we have agreed the fault."
          ),
          p(
            "We refund the price you paid for the goods and the basic cost of delivery to you, if any was charged.",
            hasStandard
              ? " Where you chose a more expensive delivery option than our standard one, we refund only the standard cost."
              : "",
            " We do not refund the cost of returning the goods to us."
          ),
          // TODO(payments): a method's own refund sentence comes from
          // BrandProfile.payment.methods[].refunds; without one, this
          // neutral wording stands.
          p(
            "Refunds go back by the method you paid with, and to no other account. Where that method cannot take a refund, we agree another way with you in writing. How long a refund takes to reach you once we send it depends on the method and on your bank or provider; that part is outside our control. We do not charge a restocking or administration fee."
          ),
          ...(refundMethods.length > 0
            ? [ul(...refundMethods.map((m): LegalInline[] => [b(m.label), `: ${m.refunds}`]))]
            : []),
        ],
      },
      {
        heading: "If you are a business customer",
        blocks: (clause) => [
          p(
            `The rights in clauses ${clause("Your right to cancel").replace("clause ", "")} to ${clause("How to cancel, and returning the goods").replace("clause ", "")} are consumer rights and do not apply to purchases made in the course of a business. Business customers may return goods only with our prior written agreement, and we may apply a restocking charge. Nothing in this clause affects a business customer’s remedies where goods are not of satisfactory quality or do not correspond with their description. Our full terms for business customers are in our `,
            a("/terms", "terms and conditions"),
            "."
          ),
        ],
      },
      {
        heading: "Complaints",
        blocks: () => [
          p(
            "If you are unhappy with how a return or refund has been handled, contact us at ",
            contact,
            ` and we will look into it. Your statutory rights against ${party(brand)} are unaffected by anything in this policy. Our complaints process is set out in our `,
            a("/terms#complaints-and-disputes", "terms and conditions"),
            "."
          ),
        ],
      },
    ]
  );
}

// ── Disclaimer ─────────────────────────────────────────────────────

export function brandDisclaimer(brand: BrandProfile): LegalDoc {
  return legalDoc(
    {
      path: "/disclaimer",
      title: "Product disclaimer",
      description: "What this product is supplied as, what it is not, and the limits of what we can be responsible for.",
      intro: "Read this before ordering. It sets out exactly what we supply, and what we do not.",
    },
    [
      {
        heading: "What we supply",
        blocks: () => [
          p(`${party(brand)} supplies ${PRODUCT.name} in a ${PRODUCT.size}. ${productLine()}`),
          p(
            "It is supplied as a ",
            b("laboratory reagent"),
            `: ${productUse()} It is a diluent. It has no activity of its own, and it is not supplied on the basis that it will achieve any particular result.`
          ),
        ],
      },
      {
        heading: "Not a medicine and not a medical device",
        blocks: () => [
          p("The product is not, and is not offered as:"),
          ul(
            [
              "a ",
              b("medicinal product"),
              ": it holds no marketing authorisation under the Human Medicines Regulations 2012 and has not been assessed by the MHRA;",
            ],
            ["a ", b("medical device"), ": it is not UKCA or CE marked under the Medical Devices Regulations 2002;"],
            ["a ", b("food, food supplement or cosmetic"), " within the meaning of the legislation governing those categories."]
          ),
          p(
            "We make ",
            b("no therapeutic, diagnostic, preventative, curative or nutritional claim"),
            " about this product, and none should be inferred from anything on this website, in our emails, or in any correspondence with us. Nothing we publish is medical, clinical, scientific, veterinary or professional advice, and none of it should be relied on as a substitute for advice from a qualified professional."
          ),
        ],
      },
      {
        heading: "Your responsibility",
        blocks: () => [
          p("You are solely responsible for:"),
          ul(
            ["deciding whether the product is suitable for your intended purpose, and satisfying yourself of that before ordering;"],
            ["the competence, training and supervision of anyone who handles it on your behalf;"],
            [
              "carrying out your own risk assessment, including under the Control of Substances Hazardous to Health Regulations 2002 where they apply to you;",
            ],
            [
              "holding any licence, permit or institutional approval your use requires, and complying with every law and regulation that applies to you; and",
            ],
            ["storing, handling and disposing of the product and its packaging in accordance with its labelling and applicable waste rules."]
          ),
          p(
            "If you are unsure about any of the above, do not order. Requirements differ by country; you are responsible for the law that applies where you are, including any import restriction."
          ),
        ],
      },
      {
        heading: "Product information and specification",
        blocks: () => [
          p(
            "We take care to describe the product accurately, but images are illustrative, and packaging, labelling and batch details may change. Where a specification, storage condition, shelf life or certificate of analysis matters to you, rely on the information printed on the vial and its labelling, and on any certificate we supply with the batch, not on this website. If a delivered batch does not match the description we gave, that is a fault, and your rights are set out in our ",
            a("/returns", "returns and refunds policy"),
            "."
          ),
        ],
      },
      {
        heading: "Limits of our responsibility",
        blocks: () => [
          p(
            "We accept no liability of any kind for loss, injury, damage or expense arising from use of the product other than as described on this page, including, without limitation, from use by a person who is not competent to handle it, or from use in breach of any law or licence that applies to you."
          ),
          p(
            b("Nothing on this page limits our liability"),
            " for death or personal injury caused by our negligence, for fraud, for defective products under Part I of the Consumer Protection Act 1987, or for anything else that cannot lawfully be limited. The full liability position, including your statutory rights as a consumer, is in our ",
            a("/terms#our-liability-to-you", "terms and conditions"),
            "."
          ),
        ],
      },
      {
        heading: "Reporting a problem",
        blocks: () => [
          p(
            "If you believe a product we supplied is defective, contaminated, mislabelled or unsafe, stop using it and tell us immediately through our ",
            a("/contact", "contact page"),
            ". Please keep the vial, its packaging and its batch identifier: we cannot investigate a batch we cannot identify. We take reports of this kind seriously and will respond to them ahead of anything else."
          ),
        ],
      },
    ]
  );
}

// ── Privacy ────────────────────────────────────────────────────────

/** What the brand's site runs, as its privacy notice must describe it. */
export interface BrandTrackingFacts {
  ga4: boolean;
  metaPixel: boolean;
  /** Purchases also reported to Meta from the server (lib/meta-capi.ts). */
  metaServer: boolean;
}

/**
 * The trackers a brand's site runs right now: its GA4 id (profile), its Meta
 * pixel (a runtime setting, as /api/pixel resolves it) and whether its
 * Conversions API token is set. Read per request, so the privacy page is
 * dynamic: a static page would go on describing yesterday's setup.
 */
export async function brandTrackingFacts(brand: BrandProfile): Promise<BrandTrackingFacts> {
  const pixel = await getBrandMetaPixelId(brand);
  const ga4 = /^G-[A-Z0-9]{4,20}$/.test(brand.analytics?.ga4Id?.trim() ?? "");
  return { ga4, metaPixel: pixel !== null, metaServer: pixel !== null && Boolean(capiAccessToken(brand)) };
}

export function brandPrivacy(brand: BrandProfile, tracking: BrandTrackingFacts): LegalDoc {
  const contact = contactLine(brand);
  const list = Boolean(brand.mailingList?.consentText);
  const trade = isTrade(brand);
  const providers = [tracking.ga4 ? "Google Analytics" : null, tracking.metaPixel ? "the Meta Pixel" : null].filter(
    (x): x is string => x !== null
  );
  const analytics = providers.length > 0;
  const many = providers.length > 1;
  const reviews = Boolean(brand.reviews.inviteBcc);
  const processors = brand.payment?.processors ?? [];
  const controllers = processors.filter((pr) => pr.separateController).map((pr) => pr.name);

  return legalDoc(
    {
      path: "/privacy",
      title: "Privacy policy",
      description: "What personal data we collect, why, who we share it with, and your rights.",
      intro: "What we collect, why we collect it, who sees it, and what you can ask us to do about it.",
    },
    [
      {
        heading: "Who we are",
        blocks: () => [
          p(
            `${party(brand)} is the `,
            b("data controller"),
            " for the personal data described in this notice. That means we decide what is collected and why, and we are accountable for it under the UK GDPR and the Data Protection Act 2018."
          ),
          ...tradingName(brand),
          dl(...companyRows(brand, { vat: false, ico: true }), ["How to reach us about data protection", [contact]]),
          p("We have not appointed a Data Protection Officer; we are not required to. Data protection questions go to the contact above."),
        ],
      },
      {
        heading: "What we collect",
        blocks: (clause) => [
          p("We collect only what an order needs. Specifically:"),
          dl(
            ["Identity and contact data", ["Your name, email address and, where you give it, your phone number."]],
            ["Delivery data", ["The postal address you give when you order, so the order can be sent to you."]],
            [
              "Order data",
              ["What you bought, the quantity, the price, the order status, and the dates the order moved between statuses."],
            ],
            [
              "Payment data",
              [
                "A payment reference from the payment provider, the provider’s name and the method used. We keep no more of your payment details than that.",
              ],
            ],
            ...(trade
              ? ([
                  ["Business details", ["If you buy for a business and give them with your order: your company name and VAT number."]],
                ] as [string, LegalInline[]][])
              : []),
            ...(tracking.metaServer
              ? ([
                  [
                    "Advertising measurement data, only if you accept cookies",
                    [
                      `Your IP address, browser details and Meta cookie identifiers, recorded when you check out so we can report the purchase to Meta. See ${clause("Cookies and analytics")}.`,
                    ],
                  ],
                ] as [string, LegalInline[]][])
              : []),
            [
              "Correspondence",
              [
                "Messages you send us, by email or through our contact form, and our replies. From the form we keep your name, your email address, what the message is about, any order number you give and what you wrote. We use it only to reply to you and deal with what you raised.",
              ],
            ],
            ["Email delivery records", ["Which order emails were sent to which address and when, so we do not send the same message twice."]],
            ...(list
              ? ([
                  [
                    "Mailing list",
                    [
                      "If you join our mailing list: your email address, when and where on the site you signed up, the wording you agreed to, and a one-way scrambled form of your IP address (used only to spot bulk sign-ups).",
                    ],
                  ],
                ] as [string, LegalInline[]][])
              : [])
          ),
          p("We do not ask for, and do not want, any special category data, including health data. Please do not send us any."),
        ],
      },
      {
        heading: "Why we use it, and our lawful basis",
        blocks: (clause) => [
          dl(
            [
              "To take and fulfil your order: performance of a contract",
              [
                "Processing payment, packing, dispatching, and sending order confirmation, dispatch and delivery emails. Without this data we cannot supply you.",
              ],
            ],
            [
              "To keep accounting and tax records: legal obligation",
              ["We must retain records of what we supplied, to whom and for how much, to satisfy HMRC and company law."],
            ],
            [
              "To answer your questions and handle returns: legitimate interests",
              [
                "Our interest in running a business that responds to its customers. We have considered your rights and consider this processing unintrusive and expected.",
              ],
            ],
            [
              "To prevent fraud and secure the site: legitimate interests",
              ["Our interest, and yours, in not being defrauded. This includes rate-limiting and checking orders that look anomalous."],
            ],
            ...(list
              ? ([["To send our mailing list: consent", [`You opted in when you signed up. See ${clause("Email we send you")}.`]]] as [
                  string,
                  LegalInline[],
                ][])
              : []),
            [
              "To send past customers repurchase reminders and occasional offers: the PECR soft opt-in",
              [`See ${clause("Email we send you")}.`],
            ],
            ...(analytics
              ? ([["To measure how the site is used: consent", [`See ${clause("Cookies and analytics")}.`]]] as [string, LegalInline[]][])
              : [])
          ),
        ],
      },
      {
        heading: "Payments",
        // TODO(payments): the providers come from BrandProfile.payment.processors.
        // Until they are set, this names none.
        blocks: () => [
          ...(processors.length > 0
            ? [
                p("Payments are handled by:"),
                ul(
                  ...processors.map((pr): LegalInline[] => [
                    b(pr.name),
                    `: ${pr.purpose}.`,
                    ...(pr.separateController
                      ? [" It is a separate data controller for the payment data it collects, and processes it under its own privacy policy."]
                      : []),
                    ...(pr.privacyUrl ? [" ", a(pr.privacyUrl, pr.privacyUrl.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, ""))] : []),
                  ])
                ),
              ]
            : [p("Payments are handled by the payment provider shown at checkout.")]),
          p(
            "We receive only what we need to fulfil the order: whether the payment cleared, a payment reference and the method used",
            trade ? ", and any business details you gave" : "",
            ", with the name, email address, phone number and delivery address you give on the provider’s page. We never see your bank or account details."
          ),
        ],
      },
      {
        heading: "Email we send you",
        blocks: () => [
          p(
            b("Transactional email."),
            " Order confirmation, dispatch and delivery notifications are part of fulfilling your order. They are not marketing and you cannot opt out of them while an order is live: you would not know where your order was."
          ),
          p(
            b("Repurchase reminders."),
            " We may email you once, some time after an order, to say that your supply is likely running low. This is marketing. We send it under the “soft opt-in” in regulation 22(3) of the Privacy and Electronic Communications Regulations 2003: you bought a similar product from us, it is about that product, and every such email carries a one-click unsubscribe link. Use it and we will record your address on a suppression list and never send you another. You may also opt out at any time by emailing ",
            contact,
            "."
          ),
          ...(list
            ? [
                p(
                  b("Our mailing list."),
                  " If you sign up on this site, we email you about offers, restocks and new products, on the basis of your consent. Every email carries a one-click unsubscribe link; use it, or email ",
                  contact,
                  ", and we stop. We keep your signup record while you are subscribed, and the fact that you unsubscribed (your email address only) so that we never email you again."
                ),
              ]
            : []),
          p(
            b("Offers to past customers."),
            " If you have bought from us, we may also occasionally email you offers on our own products under the same soft opt-in as repurchase reminders, with the same one-click unsubscribe."
          ),
          p("Email is delivered by ", b("Resend"), ", acting as our processor. We keep a record of which emails were sent to which address and when."),
        ],
      },
      {
        heading: "Cookies and analytics",
        blocks: () => [
          p(
            b(
              list
                ? "Unless you accept cookies or join our mailing list, this site sets no cookies on your browser."
                : "Unless you accept cookies, this site sets no cookies on your browser."
            ),
            " Your basket is held in your own browser’s local storage, on your device, and is never transmitted to us until you check out. Clearing your browser data clears it.",
            list
              ? " If you join our mailing list, the site sets one cookie that remembers you did, when you sign up or follow the link in one of our emails. It is strictly necessary for something you asked for, and it does not track you."
              : ""
          ),
          ...(analytics
            ? [
                p(
                  `With your consent, we also use ${providers.join(" and ")}, which ${many ? "measure" : "measures"} how the site is used and how our adverts perform. ${many ? "They set their" : "It sets its"} own cookies and identifiers on your device and ${many ? "process" : "processes"} data about your visit under ${many ? "their" : "its"} own privacy notice.`
                ),
                p(
                  b(`None of ${many ? "these loads" : "this loads"} until you click Accept on our cookie banner.`),
                  " If you click Reject, or make no choice, nothing is loaded and no tracking cookie is set. The banner remembers your choice in your browser’s local storage, which is not a cookie and is never sent to us."
                ),
                ...(tracking.metaServer
                  ? [
                      p(
                        "If you have accepted cookies and then place an order, our server also tells Meta about the purchase directly, so it is counted even if you close the page before it finishes loading. We send the order value and what you bought and, so Meta can match the purchase to an advert you saw, your email address, phone number, name, town, postcode and country in hashed form, together with your IP address, browser details and the Meta cookie identifiers already on your device. ",
                        b("If you rejected cookies or made no choice, we send Meta nothing about your order.")
                      ),
                    ]
                  : []),
                p(
                  "You can change your mind at any time with the Cookie settings link on this site. Withdrawing consent stops the tracking and clears the cookies these services left on this site’s domain. It does not affect anything collected while consent was in place."
                ),
              ]
            : [
                p(
                  "We run no analytics, advertising or tracking scripts on this site. There is no Google Analytics, no Meta Pixel and no advertising cookie. If we ever introduce one, we will ask for your consent first, as PECR requires, and update this page before it goes live."
                ),
              ]),
          // A provider's own page, its own cookies: said only of a provider
          // that has a note (BrandProfile.payment.processors[].note).
          ...processors.flatMap((pr) => (pr.note ? [p(pr.note)] : [])),
        ],
      },
      {
        heading: "Who we share it with",
        blocks: (clause) => [
          p(
            "We do not sell your personal data, and we never share it for anyone else’s marketing. We share it only with the organisations that make an order possible:"
          ),
          ul(
            ...(processors.length > 0
              ? processors.map((pr): LegalInline[] => [b(pr.name), `: ${pr.purpose}.`])
              : [[b("Our payment provider"), ": payment processing and refunds."]]),
            [b("Resend"), ": sending order and reminder emails, and passing contact form messages to our inbox."],
            ...(reviews
              ? [
                  [
                    b("Trustpilot"),
                    ": your name, email address and order reference, so Trustpilot can invite you to review your order. It sends one invitation, which you can ignore, and does not receive what you bought or your address. If you have unsubscribed from our emails we do not pass your details on.",
                  ],
                ]
              : []),
            [b("Our delivery carrier"), ": your name and delivery address, so the parcel can reach you."],
            [b("Our hosting provider"), ": which stores the site and its database on our behalf."],
            ...(tracking.metaServer
              ? [
                  [
                    b("Meta"),
                    `: only if you accepted cookies, confirmation of your purchase, to measure our adverts, under Meta’s Business Tools Terms. See ${clause("Cookies and analytics")}.`,
                  ],
                ]
              : []),
            [
              b("Professional advisers and authorities"),
              ": our accountant, and any regulator, court or law enforcement body where we are legally required to disclose.",
            ]
          ),
          p(
            "Each of these acts as our processor under a written contract",
            controllers.length > 0
              ? `, except ${controllers.join(" and ")}, which ${controllers.length > 1 ? "are separate controllers" : "is a separate controller"} for payment data`
              : "",
            ". If our business is transferred to a new owner, your data may transfer with it; the new owner would be bound by this notice."
          ),
        ],
      },
      {
        heading: "Transfers outside the UK",
        blocks: () => [
          p(
            "Some of our providers process data outside the UK, including in the United States. Where that happens we rely on the safeguards permitted by Article 46 of the UK GDPR: a UK adequacy decision where one covers the country, or the International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses, together with a transfer risk assessment. You can ask us for details of the safeguard used for any specific transfer."
          ),
        ],
      },
      {
        heading: "How long we keep it",
        blocks: () => [
          dl(
            [
              "Order and payment records",
              [
                `${RECORD_RETENTION_YEARS} years from the end of the financial year the order falls in, because HMRC requires it. We cannot delete these earlier, even on request.`,
              ],
            ],
            ["Correspondence", ["Up to 2 years after the matter is closed, so we can pick up a returning question."]],
            [
              "Email suppression list",
              ["Indefinitely. Keeping your address on a do-not-email list is the only way to guarantee we do not email you again."],
            ],
            ["Server and security logs", ["Typically 30 to 90 days, depending on the provider."]]
          ),
          p("When a retention period ends we delete the data or irreversibly anonymise it, so what remains can no longer identify you."),
        ],
      },
      {
        heading: "How we protect it",
        blocks: () => [
          p(
            "The site is served over HTTPS. Staff access to order data requires a password and a signed, secure session, and is limited to the people who need it to pack and support orders. No system is perfectly secure, and we cannot guarantee the security of data in transit across the internet, but we will notify you and the ICO where a breach is likely to result in a risk to your rights, within 72 hours of becoming aware of it."
          ),
        ],
      },
      {
        heading: "Your rights",
        blocks: () => [
          p("Under the UK GDPR you have the right to:"),
          ul(
            [b("be informed"), " about how we use your data: this notice;"],
            [b("access"), " a copy of the data we hold about you;"],
            [b("rectify"), " data that is inaccurate or incomplete;"],
            [b("erasure"), " of your data, where we have no overriding reason to keep it (tax records are such a reason);"],
            [b("restrict"), " our processing while a dispute about accuracy or legitimate interests is resolved;"],
            [b("data portability"), ": to receive the data you gave us in a structured, commonly used, machine-readable format;"],
            [
              b("object"),
              " to processing based on legitimate interests, and ",
              b("to object to direct marketing at any time, absolutely"),
              "; and",
            ],
            [b("withdraw consent"), " at any time where we rely on it, without affecting processing carried out before you withdrew it."]
          ),
          p("We do not carry out automated decision-making or profiling that produces legal or similarly significant effects."),
          p(
            "To exercise any of these, contact ",
            contact,
            ". We respond within one month, and will tell you if we need to extend that by up to two further months because the request is complex. There is no charge unless a request is manifestly unfounded or excessive. We may ask you to confirm your identity first, so that we do not disclose your data to someone else."
          ),
        ],
      },
      {
        heading: "Complaining to the regulator",
        blocks: () => [
          p(
            "If you are unhappy with how we have handled your personal data, please tell us first so we can put it right. You also have the right to complain to the Information Commissioner’s Office at any time, at ",
            a("https://ico.org.uk/make-a-complaint/", "ico.org.uk/make-a-complaint"),
            " or on 0303 123 1113. Complaining to us first is not a precondition of complaining to them."
          ),
        ],
      },
      {
        heading: "Children",
        blocks: () => [
          p(
            "This site is not intended for anyone under 18 and we do not knowingly collect data about children. If you believe a child has given us personal data, contact ",
            contact,
            " and we will delete it."
          ),
        ],
      },
      {
        heading: "Changes to this notice",
        blocks: () => [
          p(
            "We update this notice when what we do with personal data changes. The date at the top of this page is the date of the current version. Where a change materially affects you (a new purpose, a new recipient, a new lawful basis) we will tell you directly rather than relying on you re-reading this page."
          ),
        ],
      },
    ]
  );
}
