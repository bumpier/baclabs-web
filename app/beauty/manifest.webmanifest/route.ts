import { textResponse, webManifest } from "@/lib/brand/site";
import { brand } from "../site";

// Served at /manifest.webmanifest on the brand's host (middleware.ts rewrites
// it here). Every page links to that path, so this must exist.
export const revalidate = 300;

export function GET() {
  return textResponse(JSON.stringify(webManifest(brand)), "application/manifest+json");
}
