"use client";

import { useEffect, useRef, useState } from "react";
import { LABEL_HEIGHT, LABEL_WIDTH } from "@/lib/postageLabel";

/**
 * Slips and labels are separate jobs: A4 paper and sticker stock sit in
 * different printers, and one print dialog can only target one of them.
 */
const OPTIONS = [
  { type: "slips", label: "Packing slips", hint: "A4, one sheet per order" },
  { type: "labels", label: "Postage labels", hint: `${LABEL_WIDTH} × ${LABEL_HEIGHT} stickers` },
] as const;

/**
 * Each option opens the batch print page in a new tab, where the print dialog
 * opens on its own, so the dashboard stays where it was.
 */
export function PrintUnfulfilledMenu({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="btn-secondary"
        disabled={count === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Print unfulfilled ({count})
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="card absolute left-0 z-20 mt-2 w-64 overflow-hidden p-1 shadow-lift"
        >
          {OPTIONS.map((o) => (
            <a
              key={o.type}
              role="menuitem"
              href={`/admin/orders/print?type=${o.type}`}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              className="block rounded-control px-4 py-3 transition-colors hover:bg-brand-tint focus-visible:bg-brand-tint focus-visible:outline-none"
            >
              <span className="block text-sm font-semibold text-brand-deep">{o.label}</span>
              <span className="block text-xs text-ink-soft">{o.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
