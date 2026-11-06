import type { Metadata, Viewport } from "next";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { CartProvider } from "@/components/commerce/cart";
import { CookieBanner } from "@/components/commerce/CookieBanner";
import { Analytics } from "@/components/commerce/Analytics";
import { displayFont, textFont } from "@/brands/beauty/fonts";
import { SiteHeader } from "@/brands/beauty/components/SiteHeader";
import { WelcomePopup } from "@/brands/beauty/components/WelcomePopup";
import { BasketDrawerProvider } from "@/brands/beauty/components/basket-drawer";
import { announcement } from "@/brands/beauty/copy/home";
import { brand, BASKET_KEY, DESCRIPTION, LIVE, STOREFRONT } from "./site";
import { SiteFooter } from "./SiteFooter";
import { BasketDrawer } from "./BasketDrawer";
import "@/brands/beauty/styles.css";

/**
 * The brand's own root layout: its stylesheet, its fonts, its metadata,
 * nothing of BacLab's. Bounded like BacLab's store layout, so no cache in
 * front can hold a page (and its prices) for more than five minutes.
 *
 * The commerce kit's shell sits here, fed by this brand's storefront view
 * alone: the basket (every page can fill it, from ?buy= links too) and its
 * drawer, opened from the header on every page; the cookie banner and the
 * analytics tags, which load nothing until the visitor accepts; and the
 * list's welcome, which waits for the banner.
 */
export const revalidate = 300;

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

export const viewport: Viewport = brandViewport(brand);

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  const ga4Id = STOREFRONT.tracking.ga4Id;
  return (
    <html lang="en-GB" className={`${displayFont.variable} ${textFont.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only rounded-full bg-ink px-5 py-3 font-semibold text-on-plum focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            <BasketDrawerProvider>
              <SiteHeader announcement={announcement(STOREFRONT.delivery.options, STOREFRONT.delivery.freeFromMinor)} />
              {children}
              <SiteFooter />
              <BasketDrawer />
            </BasketDrawerProvider>
          </CartProvider>
          {STOREFRONT.mailingList ? <WelcomePopup consentText={STOREFRONT.mailingList.consentText} ga4Id={ga4Id} /> : null}
          <CookieBanner
            ga4Id={ga4Id}
            className="no-print fixed inset-x-0 bottom-0 z-40 p-3 sm:p-5"
            classNames={{
              panel: "bb-panel mx-auto max-w-2xl p-6",
              heading: "bb-h3 outline-none",
              text: "bb-small mt-2",
              link: "bb-link",
              actions: "mt-5 flex flex-col gap-3 sm:flex-row",
              button: "btn-quiet flex-1",
            }}
          />
          <Analytics ga4Id={ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
