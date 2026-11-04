import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { HERO } from "@/brands/beauty/copy/home";
import { brand } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /beauty/opengraph-image.
export const revalidate = 300;

/**
 * The card in the site's colours: porcelain, a blush disc holding a vial
 * top seen from above (the icon's mark), the name and the promise. Literal
 * colours, because next/og reads no CSS variables, and its own default
 * face: it cannot read woff2, and the build must never fetch a font.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: "#F8F3F3",
          color: "#3B1730",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
          <div style={{ fontSize: 112, letterSpacing: -3 }}>{brand.name}</div>
          <div style={{ marginTop: 20, fontSize: 44, color: "#6A4660" }}>{HERO.title}</div>
        </div>
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: "#F2DFDC",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: 9999,
              background: "#C49383",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 124, height: 124, borderRadius: 9999, background: "#3B1730" }} />
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
