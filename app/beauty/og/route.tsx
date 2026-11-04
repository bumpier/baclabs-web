import { brandOgImage } from "@/lib/brand/og";
import { brand, DESCRIPTION } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /beauty/opengraph-image.
export const revalidate = 300;

export function GET() {
  return brandOgImage(brand, DESCRIPTION);
}
