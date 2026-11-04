import { ImageResponse } from "next/og";
import type { BrandProfile } from "@/brands/types";
import { OG_SIZE } from "./site";

/**
 * A plain Open Graph card in the brand's colours: its name and one line.
 * A starting point for app/<id>/og/route.tsx; a brand's design replaces it.
 * Literal colours from the profile, because next/og reads no CSS variables,
 * and the system sans, so the build never fetches a font.
 */
export function brandOgImage(b: BrandProfile, line: string): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: b.colours.paper,
          color: b.colours.ink,
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ width: 72, height: 6, background: b.colours.primary }} />
        <div style={{ marginTop: 40, fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>{b.name}</div>
        <div style={{ marginTop: 16, fontSize: 40, color: b.colours.inkSoft }}>{line}</div>
      </div>
    ),
    OG_SIZE
  );
}
