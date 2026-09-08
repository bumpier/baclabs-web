import { ImageResponse } from "next/og";

// The vial mark from app/icon.svg, rendered as the 180×180 PNG iOS looks for
// when a page is added to the home screen. Generated at build time so there
// is no second bitmap to keep in step with the SVG. Colours are the literals
// from the SVG (an ImageResponse cannot read CSS variables either).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <svg viewBox="0 0 32 32" width="132" height="132">
          <rect x="11" y="3" width="10" height="5" rx="1.2" fill="#0047FF" />
          <path d="M12.5 8h7v2h-7z" fill="#0035C4" />
          <path d="M10.5 19.5h11v8A1.5 1.5 0 0 1 20 29h-8a1.5 1.5 0 0 1-1.5-1.5z" fill="#00D1FF" />
          <path
            d="M13 10v2.6L10.5 16v11.5A1.5 1.5 0 0 0 12 29h8a1.5 1.5 0 0 0 1.5-1.5V16L19 12.6V10"
            fill="none"
            stroke="#0047FF"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10.5 19.5h11" stroke="#0047FF" strokeWidth="1.2" strokeDasharray="2 2.2" />
        </svg>
      </div>
    ),
    size
  );
}
