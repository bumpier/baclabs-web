"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GALLERY } from "@/brands/beauty/copy/images";
import { ESSENTIALS } from "@/brands/beauty/copy/home";
import { Photo } from "./Photo";

/**
 * The product's pictures: one square frame you can swipe through on a phone
 * (a scroll-snap track, so it needs no script to move), and thumbnails that
 * bring each picture into the frame. The thumbnail on show carries the
 * seal. The track scrolls itself smoothly unless the visitor asks for
 * reduced motion. The pictures are copy/images.ts GALLERY.
 */
export function Gallery() {
  const items = GALLERY;
  const label = ESSENTIALS.galleryLabel;
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const frame = useRef(0);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const t = track.current;
      if (!t || t.clientWidth === 0) return;
      setActive(Math.max(0, Math.min(items.length - 1, Math.round(t.scrollLeft / t.clientWidth))));
    });
  }, [items.length]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const go = (i: number) => {
    const t = track.current;
    if (!t) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollTo({ left: i * t.clientWidth, behavior: reduce ? "auto" : "smooth" });
    setActive(i);
  };

  return (
    <div className="au-gallery" role="group" aria-label={label}>
      <div ref={track} className="au-track" onScroll={onScroll} tabIndex={0} aria-label={label}>
        {items.map((item, i) => (
          <div key={item.image.src} className="au-slide" aria-hidden={i !== active || undefined}>
            <Photo image={item.image} fill sizes="(min-width: 1024px) 50vw, (min-width: 640px) 80vw, 100vw" />
          </div>
        ))}
      </div>
      <div className="au-thumbs">
        {items.map((item, i) => (
          <button
            key={item.image.src}
            type="button"
            className="au-thumb"
            aria-current={i === active}
            aria-label={ESSENTIALS.showPicture(i + 1, item.label)}
            onClick={() => go(i)}
          >
            <Photo image={item.image} fill sizes="5rem" alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}
