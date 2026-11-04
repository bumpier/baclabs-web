import type { Metadata, Viewport } from "next";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { CartProvider } from "@/components/commerce/cart";
import { CookieBanner } from "@/components/commerce/CookieBanner";
import { Analytics } from "@/components/commerce/Analytics";
import { brand, BASKET_KEY, DESCRIPTION, LIVE, STOREFRONT } from "./site";
import { SiteFooter } from "./SiteFooter";
import "@/brands/_template/styles.css";

/**
 * The brand's own root layout: its stylesheet, its metadata, nothing of
 * BacLab's. Bounded like BacLab's store layout, so no cache in front can
 * hold a page (and its prices) for more than five minutes.
 *
 * The commerce kit's shell sits here, fed by this brand's storefront view
 * alone: the basket (every page can fill it, from ?buy= links too), the
 * cookie banner and the analytics tags, which load nothing until the
 * visitor accepts.
 */
export const revalidate = 300;

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

export const viewport: Viewport = brandViewport(brand);

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            {children}
            <SiteFooter />
          </CartProvider>
          <CookieBanner ga4Id={STOREFRONT.tracking.ga4Id} />
          <Analytics ga4Id={STOREFRONT.tracking.ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
