import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { rackCircles, WORDMARK_D, WORDMARK_VIEWBOX } from "@/brands/wholesale/components/logo";
import { brand, STOREFRONT } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /wholesale/opengraph-image.
//
// A card on the spruce ground: the lockup (the wordmark is outlined, so it
// needs no font), the product's name and the pack sizes, and on the right
// the site's SKU chip drawn large, a tie-on stock tag with its eyelet and
// a real pack code. A stock tag, not a carton label: the cartons ship
// plain. No prices: a shared card is cached by whoever shows it, long after
// a price changes. Literal colours, because next/og reads no CSS variables,
// and its own bundled sans for the words, so the build never fetches a font.
export const revalidate = 300;

const SPRUCE = "#0D3B35";
const SIGNAL = "#FCC72F";
const TINT = "#E4EEEB";
const INK_SOFT = "#4B5D59";

/** The tag, in its own units: the pointed eyelet end at the left. */
const TAG = { w: 450, h: 250, point: 40, r: 8, eye: { cx: 44, r: 10, ring: 15 } };
const PAD = 40;
const tagPath = () => {
  const { w, h, point, r } = TAG;
  return `M${point} 0H${w - r}Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${point}L0 ${h / 2}Z`;
};

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
      </svg>
    </div>
  );
}

export function GET() {
  const packs = STOREFRONT.packs;
  const shown = packs.find((p) => p.available && p.vials === 100) ?? packs[0];
  const { w, h, eye } = TAG;

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
          <div style={{ display: "flex", position: "relative", width: w, height: h, transform: "rotate(-4deg)" }}>
            <svg width={w + PAD * 2} height={h + PAD * 2} viewBox={`${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}`} style={{ position: "absolute", left: -PAD, top: -PAD }}>
              <defs>
                <filter id="drop" x="-20%" y="-20%" width="140%" height="160%">
                  <feDropShadow dx="0" dy="24" stdDeviation="18" floodColor="#000000" floodOpacity="0.35" />
                </filter>
              </defs>
              <path d={tagPath()} fill={TINT} filter="url(#drop)" />
              <circle cx={eye.cx} cy={h / 2} r={eye.ring} fill="#FFFFFF" />
              <circle cx={eye.cx} cy={h / 2} r={eye.r} fill={SPRUCE} />
            </svg>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                position: "absolute",
                left: eye.cx + eye.ring + 20,
                top: 30,
                right: 26,
                color: SPRUCE,
              }}
            >
              <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: INK_SOFT }}>Pack code</div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 36, fontWeight: 700, letterSpacing: 0.5 }}>{shown?.sku ?? ""}</div>
              <div style={{ display: "flex", height: 3, background: SPRUCE, marginTop: 16 }} />
              <div style={{ display: "flex", marginTop: 18, fontSize: 28, fontWeight: 800 }}>{shown ? `${shown.vials} × 10ml vials` : "10ml vials"}</div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 20 }}>Bacteriostatic water</div>
            </div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
