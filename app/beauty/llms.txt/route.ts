import { llmsTxt, textResponse } from "@/lib/brand/site";
import { CLINICS } from "@/brands/beauty/copy/clinics";
import { brand, DESCRIPTION } from "../site";

// Served at /llms.txt on the brand's host (middleware.ts rewrites it here).
export const revalidate = 300;

/** The brand's pages, each on its own origin, with one line on what it holds. */
const PAGES: readonly { path: string; title: string; note: string }[] = [
  { path: "/", title: "The Essentials", note: "Sets of one, three and five sealed 10ml vials, with prices and delivery." },
  { path: "/clinics", title: CLINICS.title, note: "Packs of 25, 50 and 100 vials, and the enquiry form for larger or regular orders." },
  { path: "/contact", title: "Contact", note: "Orders, delivery, returns and questions about the product." },
  { path: "/terms", title: "Terms", note: "The terms of supply." },
  { path: "/returns", title: "Returns", note: "Cancellation rights, sealed goods and refunds." },
  { path: "/privacy", title: "Privacy", note: "What personal data is collected and why." },
  { path: "/disclaimer", title: "Product disclaimer", note: "What the product is sold as." },
];

export function GET() {
  const pages = PAGES.map((p) => `- [${p.title}](${p.path === "/" ? brand.origin : `${brand.origin}${p.path}`}): ${p.note}`);
  return textResponse(`${llmsTxt(brand, DESCRIPTION)}\n## Pages\n\n${pages.join("\n")}\n`, "text/plain");
}
