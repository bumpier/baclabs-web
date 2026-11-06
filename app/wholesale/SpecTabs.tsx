"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * The tabbed specification: Specification, Packs & cartons, Delivery and
 * Documents. The panels are rendered on the server and passed in; this only
 * chooses which one shows. A link to #delivery (the header's Delivery) or
 * any other panel's id opens that tab and brings the tabs into view.
 *
 * WAI-ARIA tabs: arrow keys, Home and End move between the tabs, and the
 * selected tab is the only one in the tab order.
 */
export function SpecTabs({ label, tabs }: { label: string; tabs: readonly { id: string; label: string; panel: ReactNode }[] }) {
  const [selected, setSelected] = useState(tabs[0]?.id ?? "");
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const openFromHash = useCallback(() => {
    const id = window.location.hash.slice(1);
    if (!tabs.some((t) => t.id === id)) return;
    setSelected(id);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "start" }));
  }, [tabs]);

  useEffect(() => {
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [openFromHash]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.findIndex((t) => t.id === selected);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = tabs[next]!.id;
    setSelected(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <div className="bk-tabs">
      <div ref={listRef} role="tablist" aria-label={label} className="bk-tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-${t.id}-tab`}
            aria-selected={selected === t.id}
            aria-controls={t.id}
            tabIndex={selected === t.id ? 0 : -1}
            className="bk-tab"
            onClick={() => setSelected(t.id)}
            onKeyDown={onKey}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={t.id} role="tabpanel" aria-labelledby={`${base}-${t.id}-tab`} hidden={selected !== t.id} tabIndex={0} className="bk-tabpanel">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
