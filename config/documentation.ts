// ─────────────────────────────────────────────────────────────────
// PRODUCT DOCUMENTATION — batch records and supplier provenance.
//
// EMPTY RENDERS NOTHING, and that rule matters more here than anywhere
// else on the site. /quality-and-documentation explains what a certificate
// of analysis records and what each test does or does not demonstrate; it
// must never imply that a document exists for this product until one
// actually does.
//
// Adding a batch below publishes it. Do not add a batch you cannot produce
// the paperwork for: a fabricated COA is a false quality claim under the
// CPUTR and the DMCC Act, and it is the single easiest thing for a
// laboratory buyer to ask you to evidence.
// ─────────────────────────────────────────────────────────────────

export interface BatchDocument {
  /** Batch or lot identifier exactly as printed on the vial label. */
  batch: string;
  /** Expiry printed on that batch's label, YYYY-MM. Empty renders nothing. */
  expiry: string;
  /** Date on the document itself, YYYY-MM-DD. Not the date it was uploaded. */
  documentDate: string;
  /** Public path to the file, e.g. "/documents/coa-ABC123.pdf". */
  href: string;
  /** What the document is: "Certificate of analysis", "Specification"… */
  kind: string;
}

/**
 * Batch-linked documents, newest first. Ships EMPTY.
 *
 * Each entry needs a real file in public/documents/ and a batch identifier a
 * customer can match against the vial in their hand — a document that cannot
 * be tied to a specific vial is not evidence, it is decoration.
 */
export const BATCH_DOCUMENTS: readonly BatchDocument[] = [];

/**
 * Who manufactures or supplies the product, where that is publishable.
 * Empty renders nothing rather than a vague "sourced from trusted suppliers",
 * which asserts nothing and evidences less.
 */
export const MANUFACTURER: { name: string; country: string; note: string } = {
  name: "",
  country: "",
  note: "",
};
