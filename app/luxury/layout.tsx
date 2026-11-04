import type { Metadata, Viewport } from "next";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { CartProvider } from "@/components/commerce/cart";
import { CookieBanner } from "@/components/commerce/CookieBanner";
import { Analytics } from "@/components/commerce/Analytics";
import { COOKIES } from "@/brands/luxury/copy/site";
import { displayFace, textFace } from "@/brands/luxury/typefaces";
import { brand, BASKET_KEY, DESCRIPTION, LIVE, STOREFRONT } from "./site";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "@/brands/luxury/styles.css";

/**
 * The brand's own root layout: its stylesheet, its two faces (brands/luxury/
 * typefaces.ts), its metadata, nothing of BacLab's. Bounded like BacLab's
 * store layout, so no cache in front can hold a page (and its prices) for
 * more than five minutes.
 *
 * The commerce kit's shell sits here, fed by this brand's storefront view
 * alone: the basket (every page can fill it, from ?buy= links too, and the
 * header counts it), the cookie banner in the brand's dress and the
 * analytics tags, which load nothing until the visitor accepts.
 */
export const revalidate = 300;

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

export const viewport: Viewport = brandViewport(brand);

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${displayFace.variable} ${textFace.variable}`}>
      <body>
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            <SiteHeader />
            {children}
            <SiteFooter />
          </CartProvider>
          <CookieBanner
            ga4Id={STOREFRONT.tracking.ga4Id}
            className="no-print rx-cookies"
            classNames={{
              panel: "rx-cookies__panel rx-dark",
              heading: "rx-cookies__heading",
              text: "rx-cookies__text",
              link: "rx-link",
              actions: "rx-cookies__actions",
              button: "rx-btn rx-btn--line",
            }}
            copy={COOKIES}
          />
          <Analytics ga4Id={STOREFRONT.tracking.ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
