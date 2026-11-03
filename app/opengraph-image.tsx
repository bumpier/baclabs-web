import { ImageResponse } from "next/og";
import { PRODUCT, formatMinor } from "@/config/funnel";
import { brand } from "@/config/brand";
import { LITERAL } from "@/lib/theme";

// Generated at build time by next/og — no static asset to keep in sync with
// the price, and no extra dependency. The previous build declared an 800×600
// image and shipped a 271×100 one.
//
// BacLab's, though it sits at the app root, as do icon.svg and apple-icon.tsx:
// inside the (baclab) route group Next would serve all three at hashed URLs
// (/opengraph-image-<hash>), breaking the manifest and every shared link.
// Root file metadata reaches every root layout, so every brand layout sets its
// own `icons`, `openGraph.images` and `twitter.images` (the admin sets
// `icons`), which Next lets win: it skips root file icons for a page whose
// layouts set `icons`, and a root file image for a layout whose `openGraph`
// or `twitter` has an `images` key of its own. On a brand host these paths
// are rewritten into the brand's own tree anyway (middleware.ts), so BacLab's
// files never serve there.
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
          Sterile water with a bacteriostatic preservative · sealed multi-dose vial
        </div>
      </div>
    ),
    size
  );
}
