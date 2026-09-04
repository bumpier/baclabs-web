import { ImageResponse } from "next/og";
import { PRODUCT, formatMinor } from "@/config/funnel";
import { brand } from "@/config/brand";
import { LITERAL } from "@/lib/theme";

// Generated at build time by next/og — no static asset to keep in sync with
// the price, and no extra dependency. The previous build declared an 800×600
// image and shipped a 271×100 one.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${PRODUCT.name}, ${PRODUCT.size}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: LITERAL.paper,
          padding: 72,
          // System sans only: loading a webfont here would make every build
          // depend on a network fetch.
          fontFamily: "Helvetica, Arial, sans-serif",
          color: LITERAL.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: LITERAL.brand }} />
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>{brand.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.05 }}>
            {PRODUCT.name}
          </div>
          <div style={{ fontSize: 44, marginTop: 12, color: LITERAL.inkSoft }}>
            {`${PRODUCT.size} · ${formatMinor(PRODUCT.unitPriceMinor)} per vial`}
          </div>
        </div>

        <div style={{ fontSize: 26, color: LITERAL.inkSoft, display: "flex" }}>
          Sterile water with 0.9% benzyl alcohol · sealed multi-dose vial
        </div>
      </div>
    ),
    size
  );
}
