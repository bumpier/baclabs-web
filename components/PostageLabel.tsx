"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Physical size of the label stock. The @page rule on the label route matches. */
export const LABEL_WIDTH = "1.5in";
export const LABEL_HEIGHT = "1in";

const MAX_PT = 8; // what a short address prints at
const MIN_PT = 5; // below this an address stops being reliably scannable by eye
const STEP_PT = 0.25;

/**
 * The address block on a 1.5in × 1in sticker. A short address prints at 8pt;
 * a long one is stepped down until it fits, because a clipped postcode is an
 * undeliverable parcel. Measuring beats estimating here — line wrapping depends
 * on the actual glyph widths, so the fit runs against the rendered box.
 */
export function PostageLabel({
  name,
  lines,
  autoPrint = false,
}: {
  name: string;
  lines: string[];
  autoPrint?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [fontPt, setFontPt] = useState(MAX_PT);
  const printed = useRef(false);

  const fit = () => {
    const el = boxRef.current;
    if (!el) return;
    let pt = MAX_PT;
    el.style.fontSize = `${pt}pt`;
    while (pt > MIN_PT && el.scrollHeight > el.clientHeight) {
      pt -= STEP_PT;
      el.style.fontSize = `${pt}pt`;
    }
    setFontPt(pt);
  };

  useLayoutEffect(fit, [name, lines]);

  useEffect(() => {
    let cancelled = false;
    // Inter arrives after first paint, and it is wider than the fallback, so a
    // fit measured before it loads can under-shrink. Re-fit once it is in.
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => {
      if (cancelled) return;
      fit();
      if (autoPrint && !printed.current) {
        printed.current = true;
        window.print();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  return (
    <div
      ref={boxRef}
      className="postage-label overflow-hidden bg-white text-black"
      style={{
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT,
        padding: "0.1in",
        border: "1px dashed #c9c9c9",
        fontSize: `${fontPt}pt`,
        lineHeight: 1.2,
      }}
    >
      <p style={{ fontWeight: 700 }}>{name}</p>
      <p style={{ marginTop: "0.06in" }}>
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}
