import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import { BUNDLES, PRODUCT, formatMinor, perVialMinor } from "@/config/funnel";
import { canonicalOrigin } from "@/lib/site-url";
import { brandCssVariables } from "@/lib/theme";
import { bodyFont, displayFont } from "@/app/fonts";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const SITE = canonicalOrigin();

const PRICE = formatMinor(PRODUCT.unitPriceMinor);
/** Cheapest per-vial price across all tiers. Derived, so re-pricing a bundle
 *  in config can never leave the meta description quoting a stale figure. */
const LOWEST_PER_VIAL = formatMinor(Math.min(...BUNDLES.map(perVialMinor)));

// Authored for click-through, not assembled from config prose — the previous
// value concatenated PRODUCT.composition + PRODUCT.use and ran to 297
// characters, so Google truncated it mid-sentence. Keep this under ~155.
//
// Every claim is still verbatim from config/funnel.ts or derived from it, and
// there is no therapeutic language: the product is described only as a diluent
// for laboratory/research use. Do NOT add a delivery or dispatch claim here
// until DELIVERY.dispatchLine in config/funnel.ts holds a real figure.
const DESCRIPTION = `Sealed multi-dose ${PRODUCT.size} with 0.9% benzyl alcohol, ${PRICE} — down to ${LOWEST_PER_VIAL} a vial in bulk. Sold as a laboratory and research diluent.`;

// "Buy" and "UK" are the two commercial modifiers every competing UK seller
// carries in its title tag; the price is ours alone, and is the CTR hook.
const TITLE = `Buy ${PRODUCT.name} UK — ${PRODUCT.size}, ${PRICE}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${TITLE} | ${brand.name}`,
    template: `%s | ${brand.name}`,
  },
  description: DESCRIPTION,
  // The site is served from a single canonical origin. Without this, a
  // multi-domain deployment silently competes with itself in search.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE,
    locale: "en_GB",
    // og:image comes from app/opengraph-image.tsx via the file convention.
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    // twitter:image likewise comes from app/opengraph-image.tsx.
  },
  robots: { index: true, follow: true },
};

/**
 * `viewport-fit=cover` is the half of the safe-area contract that lives in
 * the meta tag: without it `env(safe-area-inset-*)` resolves to 0, and the
 * mobile buy bar's `max(0.75rem, env(safe-area-inset-bottom))` silently
 * becomes a plain 0.75rem under the home indicator.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: brand.company.legalName || brand.name,
  alternateName: brand.company.legalName ? brand.name : undefined,
  url: SITE,
  logo: `${SITE}/logo.svg`,
  // Omit contactPoint entirely rather than publish a placeholder. The previous
  // build shipped "+971 XX XXX XXXX" into structured data.
  contactPoint:
    brand.contact.email
      ? {
          "@type": "ContactPoint",
          email: brand.contact.email,
          ...(brand.contact.phone ? { telephone: brand.contact.phone } : {}),
          contactType: "customer service",
          areaServed: "GB",
        }
      : undefined,
  ...(brand.company.vatNumber ? { vatID: brand.company.vatNumber } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={`${bodyFont.variable} ${displayFont.variable}`}
      style={brandCssVariables() as React.CSSProperties}
    >
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
