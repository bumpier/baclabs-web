import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/brand/site";
import { SEAL, WORDMARK } from "@/brands/luxury/components/mark-paths";
import { OG_PHOTO } from "@/brands/luxury/copy/images";

// The Open Graph image, at /og on the brand's host. A route rather than an
// opengraph-image file, which would be served at /luxury/opengraph-image.
//
// The hero photograph (cropped to 1200 by 630 when the images were made, and
// read from public/luxury/, which the image ships with) with the seal and the
// wordmark over the shadow on its right, both drawn from path data, so no
// font is fetched at build or at run time.
export const revalidate = 300;

const BONE = "#F1E9E6";
const CLARET = "#4A1424";

export function GET() {
  const photo = readFileSync(path.join(process.cwd(), "public/luxury", OG_PHOTO));
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const wordWidth = 470;
  const wordHeight = Math.round((wordWidth * 108) / WORDMARK.width);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#1E1714" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain elements */}
        <img src={src} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(to left, rgba(20,14,12,0.72), rgba(20,14,12,0) 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 72,
            bottom: 72,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 28,
          }}
        >
          <svg width="84" height="84" viewBox="0 0 100 100">
            <path d={SEAL.edge} fill={BONE} />
            <path d={SEAL.ring} fill={CLARET} />
            <path d={SEAL.r} fill={CLARET} />
            <path d={SEAL.ten} fill={CLARET} />
          </svg>
          <svg width={wordWidth} height={wordHeight} viewBox={`0 -4 ${WORDMARK.width} 108`}>
            <path d={WORDMARK.d} fill={BONE} />
          </svg>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
