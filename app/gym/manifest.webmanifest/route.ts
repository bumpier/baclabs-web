import { textResponse, webManifest } from "@/lib/brand/site";
import { brand } from "../site";

// Served at /manifest.webmanifest on the brand's host (middleware.ts rewrites
// it here). Every page links to that path, so this must exist.
export const revalidate = 300;

/**
 * The shared manifest, in the site's own colours: the profile's palette is
 * the emails' and the payment page's (light paper), and the site is black
 * with hazard orange, as its viewport says too (app/gym/layout.tsx).
 */
export function GET() {
  return textResponse(
    JSON.stringify({ ...webManifest(brand), background_color: "#000000", theme_color: "#000000" }),
    "application/manifest+json"
  );
}
