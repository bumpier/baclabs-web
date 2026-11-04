"use client";

import { useState } from "react";
import type { Photo as PhotoData } from "@/brands/wholesale/copy/images";
import { Photo } from "./Photo";

/**
 * The product gallery: one stage and a row of thumbnails, as a catalogue
 * shows an item. Every photo is in the page from the start (only the first
 * loads eagerly) and the stage cross-fades between them, so a change never
 * waits on the network or shifts the layout. Thumbnails are buttons with
 * aria-pressed; the stage's arrows step through them on a phone, where the
 * thumbnails are small.
 */
export function Gallery({ photos, label }: { photos: readonly PhotoData[]; label: string }) {
  const [index, setIndex] = useState(0);
  const step = (by: number) => setIndex((i) => (i + by + photos.length) % photos.length);
  const current = photos[index];

  return (
    <section className="vh-gallery" aria-label={label}>
      <div className="vh-stage">
        {photos.map((p, i) => (
          <div key={p.src} className="vh-stage-frame" data-on={i === index ? "" : undefined} aria-hidden={i === index ? undefined : true}>
            <Photo photo={p} priority={i === 0} sizes="(min-width: 1280px) 700px, (min-width: 1024px) 56vw, 100vw" />
          </div>
        ))}
        <div className="vh-stage-nav">
          <button type="button" className="vh-stage-btn" onClick={() => step(-1)} aria-label="Previous photo">
            <Chevron dir="left" />
          </button>
          <span className="vh-stage-count" aria-live="polite">
            <span className="sr-only">Photo </span>
            {index + 1} of {photos.length}
            <span className="sr-only">: {current?.short}</span>
          </span>
          <button type="button" className="vh-stage-btn" onClick={() => step(1)} aria-label="Next photo">
            <Chevron dir="right" />
          </button>
        </div>
      </div>
      <ul className="vh-thumbs">
        {photos.map((p, i) => (
          <li key={p.src}>
            <button type="button" className="vh-thumb" aria-pressed={i === index} onClick={() => setIndex(i)}>
              <Photo photo={p} alt="" sizes="(min-width: 1024px) 160px, 25vw" />
              <span className="sr-only">Show photo {i + 1}: {p.short}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={dir === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
