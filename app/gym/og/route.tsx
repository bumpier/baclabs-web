import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { formatGbp } from "@/lib/commerce/view";
import { HERO } from "@/brands/gym/copy/home";
import { brand, STOREFRONT } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /gym/opengraph-image.
export const revalidate = 300;

/**
 * The link preview is the hero: the 10-pack's count and price on black, the
 * price in hazard orange, a hazard band along the foot. Literal colours,
 * because next/og reads no CSS variables, and the system sans in its
 * heaviest weight, so the build never fetches a font (next/og cannot read
 * the site's woff2 files either). With no pack on sale it is the name alone.
 */
export function GET() {
  const packs = STOREFRONT.packs.filter((p) => p.available);
  const pack = packs.find((p) => p.vials === 10) ?? packs[0] ?? null;
  const orange = "#FF6B00";
  const chalk = "#F2F2ED";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          color: chalk,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 80px 0" }}>
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>{brand.name}</div>
          {pack ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 28, lineHeight: 0.9, fontWeight: 900, textTransform: "uppercase" }}>
              <div style={{ fontSize: 120, letterSpacing: -3 }}>{HERO.count(pack.vials)}</div>
              <div style={{ fontSize: 150, letterSpacing: -4, color: orange }}>{HERO.price(formatGbp(pack.priceMinor))}</div>
              <div style={{ fontSize: 120, letterSpacing: -3 }}>{HERO.done}</div>
            </div>
          ) : null}
        </div>
        <div
          style={{
            height: 40,
            backgroundImage: `repeating-linear-gradient(-45deg, ${orange} 0px, ${orange} 24px, #000000 24px, #000000 48px)`,
          }}
        />
      </div>
    ),
    OG_SIZE
  );
}
