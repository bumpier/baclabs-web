import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import BacLabRootLayout, {
  metadata as siteMetadata,
  viewport as siteViewport,
} from "./(baclab)/layout";
import NotFound, { metadata as notFoundMetadata } from "./(baclab)/not-found";

/**
 * The page for a URL no route matches (experimental.globalNotFound in
 * next.config.js). The app has one root layout per site (BacLab's, the
 * admin's, each brand's) and none above them, so Next's own 404 for an
 * unmatched URL would have no layout to render in. This is BacLab's 404
 * exactly as it was: its root layout around its not-found page, prerendered,
 * with the same metadata.
 *
 * A brand host never gets here: middleware.ts rewrites every path on a brand
 * host into that brand's tree, whose own catch-all and not-found.tsx answer
 * a miss. Direct requests for a brand's internal paths (/<id>/…) are sent
 * here on purpose, so they 404 as BacLab on BacLab's domain.
 */
export const metadata: Metadata = {
  ...siteMetadata,
  ...notFoundMetadata,
  // No parent here to apply BacLab's "%s | BacLab" template, so it is spelled out.
  title: `${notFoundMetadata.title} | ${brand.name}`,
};

export const viewport: Viewport = siteViewport;

export default function GlobalNotFound() {
  return (
    <BacLabRootLayout>
      <NotFound />
    </BacLabRootLayout>
  );
}
