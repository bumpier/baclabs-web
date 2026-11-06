"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { PRODUCT } from "@/brands/luxury/copy/home";

/**
 * The product's photographs. On a wide screen, a column of tall images
 * that scrolls past the sticky purchase column; on a phone, the same list
 * as a strip to swipe, with a mark per image below it that says which one
 * is showing and moves to another.
 *
 * The images' attributes are next/image's, worked out on the server
 * (brands/luxury/components/photo.ts) and passed in as plain data.
 */
export function Gallery({ photos }: { photos: ImgHTMLAttributes<HTMLImageElement>[] }) {
  const showing = PRODUCT.gallery.showing;
  const track = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);

  // Which image fills the strip. On a wide screen the list does not scroll
  // sideways and the marks are hidden, so this only matters on a phone.
  useEffect(() => {
    const root = track.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const items = Array.from(root.children);
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setCurrent(items.indexOf(e.target));
        }
      },
      { root, threshold: 0.6 }
    );
    items.forEach((i) => seen.observe(i));
    return () => seen.disconnect();
  }, []);

  const go = (i: number) => {
    const item = track.current?.children[i] as HTMLElement | undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    item?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "start" });
  };

  return (
    <div className="lv-gallery" role="group" aria-label={PRODUCT.gallery.label}>
      <ul ref={track} className="lv-gallery__track">
        {photos.map((p) => (
          <li key={String(p.src)} className="lv-gallery__item">
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/image's attributes, alt included (components/photo.ts) */}
            <img {...p} className="lv-gallery__img" draggable={false} />
          </li>
        ))}
      </ul>
      <div className="lv-gallery__marks">
        {photos.map((p, i) => (
          <button
            key={String(p.src)}
            type="button"
            className="lv-gallery__mark"
            aria-label={showing(i + 1, photos.length)}
            aria-current={i === current ? "true" : undefined}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
