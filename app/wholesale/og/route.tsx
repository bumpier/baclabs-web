import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { rackCircles, WORDMARK_D, WORDMARK_DOT, WORDMARK_VIEWBOX } from "@/brands/wholesale/components/logo";
import { brand, STOREFRONT } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /wholesale/opengraph-image.
//
// The brand's shipping label, as a card: spruce ground with the lockup (the
// wordmark is outlined, so it needs no font), the product's name and the
// pack sizes, and on the right the label itself with a real pack code and
// bars that encode nothing. No prices: a shared card is cached by whoever
// shows it, long after a price changes. Literal colours, because next/og
// reads no CSS variables, and its own bundled sans for the words, so the
// build never fetches a font.
export const revalidate = 300;

const SPRUCE = "#0D3B35";
const SIGNAL = "#FCC72F";
const INK = "#13211F";

const BARS = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2, 2, 1, 4, 1, 1, 2, 1, 1, 3, 1, 2, 1, 2, 3, 1];

function Lockup({ height }: { height: number }) {
  const [, , w, h] = WORDMARK_VIEWBOX.split(" ").map(Number);
  const wordW = (height * w!) / h!;
  const markH = height * 0.954;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: height * 0.36 }}>
      <svg width={(markH * 5) / 3} height={markH} viewBox="0 0 50 30" style={{ marginTop: height * 0.03 }}>
        {rackCircles().map(({ cx, cy, filled }) =>
          filled ? (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={SIGNAL} />
          ) : (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.1} fill="none" stroke="#FFFFFF" strokeWidth={1.5} opacity={0.5} />
          )
        )}
      </svg>
      <svg width={wordW} height={height} viewBox={WORDMARK_VIEWBOX}>
        <path fill="#FFFFFF" d={WORDMARK_D} />
        <circle cx={WORDMARK_DOT.cx} cy={WORDMARK_DOT.cy} r={WORDMARK_DOT.r} fill={SIGNAL} />
      </svg>
    </div>
  );
}

export function GET() {
  const packs = STOREFRONT.packs;
  const shown = packs.find((p) => p.available && p.vials === 100) ?? packs[0];
  const total = BARS.reduce((a, b) => a + b, 0);
  let x = 0;
  const bars = BARS.map((u, i) => {
    const rect = i % 2 === 0 ? { x, w: u } : null;
    x += u;
    return rect;
  }).filter((r): r is { x: number; w: number } => r !== null);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: SPRUCE, color: "#FFFFFF", padding: "64px 72px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          <Lockup height={44} />
          <div style={{ display: "flex", marginTop: 72, fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
            Bacteriostatic water 10ml
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 28, lineHeight: 1.35, color: "#CFE0DA" }}>
            {`By the pack, priced per vial. ${brand.name} supplies trade and public orders.`}
          </div>
          <div style={{ display: "flex", marginTop: "auto", gap: 10 }}>
            {packs.map((p) => (
              <div
                key={p.sku}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "10px 14px",
                  borderRadius: 4,
                  background: p.available ? SIGNAL : "rgba(255,255,255,0.12)",
                  color: p.available ? SPRUCE : "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", fontSize: 26, fontWeight: 800 }}>{p.vials.toLocaleString("en-GB")}</div>
                <div style={{ display: "flex", fontSize: 16 }}>{p.available ? "vials online" : "vials by quote"}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 400,
              background: "#FFFFFF",
              borderRadius: 8,
              padding: 18,
              color: INK,
              transform: "rotate(-4deg)",
              boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", background: SPRUCE, height: 64, paddingLeft: 18 }}>
              <Lockup height={22} />
              <div style={{ display: "flex", marginLeft: "auto", width: 58, height: 64, background: SIGNAL }} />
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 40, fontWeight: 700, letterSpacing: 1 }}>{shown?.sku ?? ""}</div>
            <div style={{ display: "flex", height: 3, background: INK, marginTop: 10 }} />
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 16, gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 800 }}>{shown ? `${shown.vials} × 10ml vials` : "10ml vials"}</div>
                <div style={{ display: "flex", fontSize: 18, marginTop: 6 }}>Bacteriostatic water</div>
              </div>
              <svg width={150} height={70} viewBox={`0 0 ${total} 40`} preserveAspectRatio="none">
                {bars.map((b) => (
                  <rect key={b.x} x={b.x} y={0} width={b.w} height={40} fill={INK} />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
