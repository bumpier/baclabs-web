import type { Metadata, Viewport } from "next";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { CartProvider } from "@/components/commerce/cart";
import { Analytics } from "@/components/commerce/Analytics";
import { bodyFont, displayFont, stencilFont } from "@/brands/gym/fonts";
import { Header } from "@/brands/gym/components/Header";
import { GymCookieBanner } from "@/brands/gym/components/GymCookieBanner";
import { brand, BASKET_KEY, DESCRIPTION, LIVE, STOREFRONT } from "./site";
import { SiteFooter } from "./SiteFooter";
import "@/brands/gym/styles.css";

/**
 * The brand's own root layout: its stylesheet, its fonts, its metadata,
 * nothing of BacLab's. Bounded like BacLab's store layout, so no cache in
 * front can hold a page (and its prices) for more than five minutes.
 *
 * The commerce kit's shell sits here, fed by this brand's storefront view
 * alone: the basket (every page can fill it, from ?buy= links too), the
 * cookie banner and the analytics tags, which load nothing until the
 * visitor accepts. The header and footer frame every page.
 */
export const revalidate = 300;

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

/**
 * A dark site: the browser chrome and form controls match the black page.
 * The profile's colours stay the emails' and the payment page's (light
 * paper), so the page's own are set here.
 */
export const viewport: Viewport = { ...brandViewport(brand), colorScheme: "dark", themeColor: "#000000" };

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${bodyFont.variable} ${displayFont.variable} ${stencilFont.variable}`}>
      <body>
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            <Header name={brand.name} />
            {children}
            <SiteFooter />
          </CartProvider>
          <GymCookieBanner ga4Id={STOREFRONT.tracking.ga4Id} />
          <Analytics ga4Id={STOREFRONT.tracking.ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
