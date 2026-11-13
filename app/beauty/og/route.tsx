import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { WORDMARK } from "@/brands/beauty/components/wordmark-paths";
import { brand } from "../site";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /beauty/opengraph-image.
export const revalidate = 300;

// The photograph: the still life cropped to the card, its empty wall on the
// left. JPEG, because next/og cannot read WebP. Read from public/ on disk
// (the server runs from the repo's root, where public/ is), never fetched.
// A stand-in, to replace with real photography, as copy/images.ts.
const PHOTO = path.join(process.cwd(), "public/beauty/images/og-still-life.jpg");

// Literal colours: next/og reads no CSS variables. The plum of the ink, the
// cap's blue and the crimp's silver (brands/beauty/styles.css).
const PLUM = "#3B1730";
const CAP = "#1747C8";
const CRIMP = "#C9CDD3";

/**
 * The card is the brand's first picture: the still life, and the wordmark
 * on its wall with the seal ringed in silver. No line of text beside it:
 * next/og cannot read the brand's woff2 faces, and a fallback face would
 * not be BeautyBac's.
 */
export async function GET() {
  const photo = await readFile(PHOTO);
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const [, , vw, vh] = WORDMARK.viewBox.split(" ").map(Number);
  // Set by the height of its capitals (about 87px), on the wall left of
  // the plinth.
  const width = 620;
  const height = Math.round((width * vh!) / vw!);
  const { cx, cy, r } = WORDMARK.seal;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#F2DFDC" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img> */}
        <img src={src} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", left: 84, top: 92, display: "flex" }}>
          <svg width={width} height={height} viewBox={WORDMARK.viewBox} aria-label={brand.name}>
            <path d={WORDMARK.d} fill={PLUM} />
            <circle cx={cx} cy={cy} r={r + 14} fill={CRIMP} />
            <circle cx={cx} cy={cy} r={r} fill={CAP} />
          </svg>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
