/**
 * Legal text as data: what lib/commerce/legal.ts writes for a brand and
 * components/commerce/LegalPage.tsx renders. Data rather than JSX so the
 * whole of a brand's terms can be read as plain text, which is how
 * checkBrandCopy (lib/content-rules.ts) and npm run test:kit scan it.
 *
 * Imports nothing: a client component may render it too.
 */

/** A run of text: plain, strong, or a link (a site path, a mailto: or an https URL). */
export type LegalInline = string | { strong: string } | { href: string; text: string };

export type LegalBlock =
  | { kind: "p"; content: LegalInline[] }
  | { kind: "h3"; text: string }
  | { kind: "ul" | "ol"; items: LegalInline[][] }
  | { kind: "dl"; items: { term: string; detail: LegalInline[] }[] };

export interface LegalSection {
  /** The section's anchor, from its heading, so a clause can be linked to (/terms#complaints). */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  /** The page's own path ("/terms"), for its breadcrumb and canonical. */
  path: string;
  title: string;
  /** The page's meta description. */
  description: string;
  intro: string;
  /** The date the wording last changed, as printed ("12 October 2026"). */
  lastUpdated: string;
  sections: LegalSection[];
}

/** Who "we" are, for the line under the title and the foot of the page. */
export interface LegalIdentity {
  /** The brand's public name. */
  name: string;
  /** The party to the contract: the registered name, or the brand's name until one is set. */
  party: string;
  /** Where questions about the page go. null: the contact page instead. */
  contactEmail: string | null;
}

/** A heading's anchor: "Price and payment" is "price-and-payment". */
export function legalAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Every visible string in a document, in order: for scanning, never for display. */
export function legalDocText(doc: LegalDoc): string[] {
  const inline = (runs: LegalInline[]) =>
    runs.map((r) => (typeof r === "string" ? r : "strong" in r ? r.strong : r.text)).join("");
  const out = [doc.title, doc.description, doc.intro];
  for (const s of doc.sections) {
    out.push(s.heading);
    for (const b of s.blocks) {
      if (b.kind === "p") out.push(inline(b.content));
      else if (b.kind === "h3") out.push(b.text);
      else if (b.kind === "dl") for (const i of b.items) out.push(i.term, inline(i.detail));
      else for (const i of b.items) out.push(inline(i));
    }
  }
  return out;
}
