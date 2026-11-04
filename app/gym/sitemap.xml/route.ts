import { sitemapXml, textResponse } from "@/lib/brand/site";
import { brand, PAGES } from "../site";

// Served at /sitemap.xml on the brand's host (middleware.ts rewrites it here).
export const revalidate = 300;

export function GET() {
  return textResponse(sitemapXml(brand, PAGES), "application/xml");
}
