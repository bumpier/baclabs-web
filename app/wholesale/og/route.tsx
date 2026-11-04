import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { brand, DESCRIPTION, STOREFRONT } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /wholesale/opengraph-image.
//
// The site's sheet in miniature: the steel band with the name, the line,
// and the pack sizes as a ruled row, sold online or by quote. No prices: a
// shared card is cached by whoever shows it, long after a price changes.
// Literal colours, because next/og reads no CSS variables, and its own
// bundled sans, so the build never fetches a font.
export const revalidate = 300;

export function GET() {
  const packs = STOREFRONT.packs;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#E3E8ED", color: "#142131" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, background: "#1E2A38", color: "#FFFFFF", padding: "48px 72px" }}>
          <div style={{ display: "flex", width: 72, height: 72, background: "#FFFFFF", alignItems: "flex-end", justifyContent: "center", paddingBottom: 10 }}>
            <div style={{ width: 52, height: 5, background: "#12784A" }} />
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>{brand.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "48px 72px 0", flex: 1 }}>
          <div style={{ fontSize: 40, lineHeight: 1.25, color: "#1E3A5F", maxWidth: 980 }}>{DESCRIPTION}</div>
          <div style={{ display: "flex", marginTop: "auto", marginBottom: 64, border: "2px solid #1E2A38", background: "#FFFFFF" }}>
            {packs.map((p, i) => (
              <div
                key={p.sku}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "18px 22px",
                  borderLeft: i === 0 ? "none" : "1px solid #C3CCD6",
                }}
              >
                <div style={{ fontSize: 44, fontWeight: 800, color: "#1E2A38" }}>{p.vials.toLocaleString("en-GB")}</div>
                <div style={{ fontSize: 22, color: p.available ? "#12784A" : "#4A5A70" }}>{p.available ? "vials, online" : "vials, by quote"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
