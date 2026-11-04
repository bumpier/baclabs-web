import type { Metadata, Viewport } from "next";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { CartProvider } from "@/components/commerce/cart";
import { Analytics } from "@/components/commerce/Analytics";
import { formatGbp } from "@/lib/commerce/view";
import { bodyFont, stencilFont } from "@/brands/gym/fonts";
import { MARQUEE } from "@/brands/gym/copy/home";
import { SITE } from "@/brands/gym/copy/site";
import { Header } from "@/brands/gym/components/Header";
import { Marquee } from "@/brands/gym/components/Marquee";
import { GymCookieBanner } from "@/brands/gym/components/GymCookieBanner";
import { brand, BASKET_KEY, DESCRIPTION, LIVE, STOREFRONT } from "./site";
import { CartShell } from "./CartShell";
import { SiteFooter } from "./SiteFooter";
import "@/brands/gym/styles.css";

/**
 * The brand's own root layout: its stylesheet, its fonts, its metadata,
 * nothing of BacLab's. Bounded like BacLab's store layout, so no cache in
 * front can hold a page (and its prices) for more than five minutes.
 *
 * The commerce kit's shell sits here, fed by this brand's storefront view
 * alone: the cart (every page can fill it, from ?buy= links too) and the
 * slide-out cart drawer with the one checkout (CartShell), the cookie banner
 * and the analytics tags, which load nothing until the visitor accepts. The
 * marquee, the header and the footer frame every page.
 */
export const revalidate = 300;

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

/**
 * A dark site: the browser chrome and form controls match the black page.
 * The profile's colours stay the emails' and the payment page's (light
 * paper), so the page's own are set here.
 */
export const viewport: Viewport = { ...brandViewport(brand), colorScheme: "dark", themeColor: "#000000" };

/** The marquee's facts, each from the view: the next-day cutoff, the free-delivery line, the packs. */
function marqueeFacts(): string[] {
  const options = STOREFRONT.delivery.options;
  const timed = options.find((o) => o.cutoff) ?? null;
  const free = options.find((o) => o.overThreshold === "free") ?? null;
  const from = STOREFRONT.delivery.freeFromMinor;
  const counts = STOREFRONT.packs.filter((p) => p.available).map((p) => p.vials);
  return [
    ...(timed?.cutoff ? [MARQUEE.cutoff(timed.cutoff, timed.label)] : []),
    ...(free && from !== null ? [MARQUEE.free(free.label, formatGbp(from))] : []),
    ...(options.length > 0 ? [MARQUEE.tracked] : []),
    MARQUEE.sealed,
    ...(counts.length > 0 ? [MARQUEE.packs(SITE.sizes(counts))] : []),
  ];
}

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${bodyFont.variable} ${stencilFont.variable}`}>
      <body>
        <BrandPathnameProvider id={brand.id}>
          <CartProvider storageKey={BASKET_KEY} storefront={STOREFRONT}>
            <CartShell>
              <Marquee facts={marqueeFacts()} label={MARQUEE.label} />
              <Header name={brand.name} />
              {children}
              <SiteFooter />
            </CartShell>
          </CartProvider>
          <GymCookieBanner ga4Id={STOREFRONT.tracking.ga4Id} />
          <Analytics ga4Id={STOREFRONT.tracking.ga4Id} />
        </BrandPathnameProvider>
      </body>
    </html>
  );
}
