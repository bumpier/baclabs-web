import type { Metadata, Viewport } from "next";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { CartProvider } from "@/components/commerce/cart";
import { CookieBanner } from "@/components/commerce/CookieBanner";
import { Analytics } from "@/components/commerce/Analytics";
import { photoProps } from "@/brands/luxury/components/photo";
import { GALLERY } from "@/brands/luxury/copy/images";
import { COOKIES } from "@/brands/luxury/copy/site";
import { displayFace, serifFace, textFace } from "@/brands/luxury/typefaces";
import { brand, BASKET_KEY, DESCRIPTION, LIVE, STOREFRONT } from "./site";
import { BagProvider } from "./Bag";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "@/brands/luxury/styles.css";

/**
 * The brand's own root layout: its stylesheet, its three faces (brands/
 * luxury/typefaces.ts), its metadata, nothing of BacLab's. Bounded like
 * BacLab's store layout, so no cache in front can hold a page (and its
 * prices) for more than five minutes.
 *
 * The commerce kit's shell sits here, fed by this brand's storefront view
 * alone: the basket (every page can fill it, from ?buy= links too), and
 * inside it the bag (app/luxury/Bag.tsx), whose drawer every page can open
 * from the header. Then the cookie banner in the brand's dress and the
 * analytics tags, which load nothing until the visitor accepts.
 */
export const revalidate = 300;

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

export const viewport: Viewport = brandViewport(brand);

/** The bag's line photograph: the box open, small. */
const THUMB = photoProps(GALLERY[1]!, { sizes: "72px" });

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${displayFace.variable} ${serifFace.variable} ${textFace.variable}`}>
      <body className="rv-body">
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            <BagProvider thumb={THUMB}>
              <SiteHeader />
              {children}
              <SiteFooter />
            </BagProvider>
          </CartProvider>
          <CookieBanner
            ga4Id={STOREFRONT.tracking.ga4Id}
            className="no-print rv-cookies"
            classNames={{
              panel: "rv-cookies__panel",
              heading: "rv-cookies__heading",
              text: "rv-cookies__text",
              link: "rv-link",
              actions: "rv-cookies__actions",
              button: "rv-button rv-button--quiet",
            }}
            copy={COOKIES}
          />
          <Analytics ga4Id={STOREFRONT.tracking.ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
