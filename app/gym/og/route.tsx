import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { formatGbp } from "@/lib/commerce/view";
import { HERO } from "@/brands/gym/copy/home";
import { OG_HERO } from "@/brands/gym/copy/images";
import { Mark, Wordmark } from "@/brands/gym/components/Logo";
import { STOREFRONT } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /gym/opengraph-image.
export const revalidate = 300;

const HAZARD = "#F5C400";
const CHALK = "#F4F5F6";

/** A file of the app's own, read from disk; null if it is not there (the card then does without it). */
function own(...parts: string[]): Buffer | null {
  try {
    return readFileSync(path.join(process.cwd(), ...parts));
  } catch {
    return null;
  }
}

/**
 * The link preview is the hero: the box on the gym floor, the headline over
 * the dark side, the lowest price a vial in the stencil cut, the mark and the
 * wordmark (drawn, not typed), and the hazard band along the foot. Literal
 * colours, because next/og reads no CSS variables. Its fonts are the site's
 * own families in the static .woff cuts next/og can read (brands/gym/fonts/og,
 * never sent to a browser); the photograph is public/gym/images. Either one
 * missing, the card is drawn without it rather than failing.
 */
export function GET() {
  const packs = STOREFRONT.packs.filter((p) => p.available);
  const cheapest = packs.length > 0 ? packs.reduce((a, b) => (b.perVialMinor < a.perVialMinor ? b : a)) : null;
  const photo = own("public", "gym", "images", OG_HERO);
  const archivo = own("brands", "gym", "fonts", "og", "archivo-latin-800-normal.woff");
  const stencil = own("brands", "gym", "fonts", "og", "big-shoulders-stencil-display-latin-900-normal.woff");
  const fonts = [
    ...(archivo ? [{ name: "Archivo", data: archivo, weight: 800 as const, style: "normal" as const }] : []),
    ...(stencil ? [{ name: "Stencil", data: stencil, weight: 900 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000000",
          color: CHALK,
          fontFamily: archivo ? "Archivo" : "Helvetica, Arial, sans-serif",
          position: "relative",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
          <img
            src={`data:image/jpeg;base64,${photo.toString("base64")}`}
            width={1200}
            height={630}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.7) 42%, rgba(0,0,0,0) 72%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 72px 0", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Mark size={64} plate={HAZARD} ink="#000000" />
            <Wordmark height={34} fill={CHALK} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 104, lineHeight: 0.9, letterSpacing: -2, textTransform: "uppercase" }}>
            {HERO.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
          {cheapest ? (
            <div
              style={{
                marginTop: 28,
                fontSize: 44,
                color: HAZARD,
                fontFamily: stencil ? "Stencil" : undefined,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {HERO.from(Math.min(...packs.map((p) => p.vials)), Math.max(...packs.map((p) => p.vials)), formatGbp(cheapest.perVialMinor))}
            </div>
          ) : null}
        </div>
        <div
          style={{
            height: 28,
            position: "relative",
            backgroundImage: `repeating-linear-gradient(-45deg, ${HAZARD} 0px, ${HAZARD} 20px, #000000 20px, #000000 40px)`,
          }}
        />
      </div>
    ),
    { ...OG_SIZE, fonts }
  );
}
