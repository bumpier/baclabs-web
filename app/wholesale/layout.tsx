import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { CartProvider } from "@/components/commerce/cart";
import { CookieBanner } from "@/components/commerce/CookieBanner";
import { Analytics } from "@/components/commerce/Analytics";
import { brand, BASKET_KEY, DESCRIPTION, LIVE, STOREFRONT } from "./site";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "@/brands/wholesale/styles.css";

/**
 * The brand's own root layout: its stylesheet, its fonts, its metadata,
 * nothing of BacLab's. Bounded like BacLab's store layout, so no cache in
 * front can hold a page (and its prices) for more than five minutes.
 *
 * The commerce kit's shell sits here, fed by this brand's storefront view
 * alone: the basket (every page can fill it, from ?buy= links too), the
 * cookie banner and the analytics tags, which load nothing until the
 * visitor accepts.
 */
export const revalidate = 300;

/**
 * Overpass, by Delve Withrington, Dave Bailey and Thomas Jockin, under the
 * SIL Open Font License 1.1: the latin subset of the variable font (weight
 * 100 to 900), from the @fontsource-variable/overpass package. A signage
 * grotesk in the Highway Gothic line, the lettering of aisle markers and
 * carton stencils. Self-hosted, never fetched at build time: the CSP allows
 * fonts from this site only (font-src 'self').
 */
const overpass = localFont({
  src: "../../brands/wholesale/fonts/overpass-latin-wght.woff2",
  variable: "--font-overpass",
  display: "swap",
  weight: "100 900",
});

/**
 * Overpass Mono, same family and licence (@fontsource-variable/overpass-mono,
 * weight 300 to 700): for pack codes and nothing else, the way a code is
 * printed on a label.
 */
const overpassMono = localFont({
  src: "../../brands/wholesale/fonts/overpass-mono-latin-wght.woff2",
  variable: "--font-overpass-mono",
  display: "swap",
  weight: "300 700",
});

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

export const viewport: Viewport = brandViewport(brand);

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${overpass.variable} ${overpassMono.variable}`}>
      <body>
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            <a href="#main" className="vh-skip">
              Skip to content
            </a>
            <SiteHeader />
            {children}
            <SiteFooter />
          </CartProvider>
          <CookieBanner
            ga4Id={STOREFRONT.tracking.ga4Id}
            classNames={{
              panel: "vh-banner",
              heading: "vh-banner-title",
              button: "vh-btn-outline flex-1",
            }}
          />
          <Analytics ga4Id={STOREFRONT.tracking.ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
