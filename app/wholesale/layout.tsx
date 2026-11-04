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
 * The brand's own root layout: its stylesheet, its font, its metadata,
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
 * Archivo, by Omnibus-Type, under the SIL Open Font License 1.1: the latin
 * subset of the variable font with both its axes, weight (100 to 900) and
 * width (62% to 125%), from the @fontsource-variable/archivo package. It
 * is in the repo and self-hosted, never fetched at build time: the CSP
 * allows fonts from this site only (font-src 'self'), and a Google fetch
 * once failed a deploy (app/fonts.ts). The width range is declared so
 * font-stretch drives the width axis: the title and the pack sizes are set
 * expanded, text at normal width.
 */
const archivo = localFont({
  src: "../../brands/wholesale/fonts/archivo-latin.woff2",
  variable: "--font-archivo",
  display: "swap",
  weight: "100 900",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

export const viewport: Viewport = brandViewport(brand);

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={archivo.variable}>
      <body>
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            <a href="#main" className="wh-skip">
              Skip to content
            </a>
            <SiteHeader />
            {children}
            <SiteFooter />
          </CartProvider>
          <CookieBanner
            ga4Id={STOREFRONT.tracking.ga4Id}
            classNames={{
              panel: "wh-banner mx-auto max-w-2xl p-5",
              heading: "text-lg font-bold text-steel",
              button: "btn-quiet flex-1",
            }}
          />
          <Analytics ga4Id={STOREFRONT.tracking.ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
