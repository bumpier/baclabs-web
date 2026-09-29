"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; hint?: string };
export type NavGroup = { label: string; items: NavLink[] };
export type NavEntry = NavLink | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => "items" in e;

/**
 * The most specific href that contains the current path wins, so
 * /admin/orders/scan lights up "Scan station" rather than "All orders".
 */
function activeHref(entries: NavEntry[], pathname: string): string | null {
  const hrefs = entries.flatMap((e) => (isGroup(e) ? e.items : [e])).map((l) => l.href);
  let best: string | null = null;
  for (const href of hrefs) {
    const matches =
      pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));
    if (matches && (!best || href.length > best.length)) best = href;
  }
  return best;
}

function Chevron({ open }: { open: boolean }) {
  return (
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
  );
}

const topLinkClass = (active: boolean) =>
  `inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors ${
    active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
  }`;

/**
 * A disclosure nav rather than an ARIA menu: each group is a button that
 * shows a panel of ordinary links, which is what screen readers expect of
 * site navigation. Below md it folds into one "Menu" panel.
 */
export function AdminNav({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  const current = activeHref(entries, pathname);
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(null);
  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));

  return (
    <div ref={rootRef} className="text-sm">
      {/* Desktop */}
      <nav aria-label="Admin" className="hidden items-center gap-1 md:flex">
        {entries.map((entry) => {
          if (!isGroup(entry)) {
            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={current === entry.href ? "page" : undefined}
                className={topLinkClass(current === entry.href)}
              >
                {entry.label}
              </Link>
            );
          }
          const isOpen = open === entry.label;
          const groupActive = entry.items.some((i) => i.href === current);
          return (
            <div key={entry.label} className="relative">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(entry.label)}
                className={topLinkClass(groupActive || isOpen)}
              >
                {entry.label}
                <Chevron open={isOpen} />
              </button>
              {isOpen && (
                <div className="card absolute left-0 z-30 mt-2 w-64 overflow-hidden p-1 text-ink shadow-lift">
                  {entry.items.map((item) => (
                    <DropdownLink
                      key={item.href}
                      item={item}
                      active={item.href === current}
                      onNavigate={close}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Mobile */}
      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={open === "mobile"}
          onClick={() => toggle("mobile")}
          className={topLinkClass(open === "mobile")}
        >
          Menu
          <Chevron open={open === "mobile"} />
        </button>
        {open === "mobile" && (
          <nav
            aria-label="Admin"
            className="card absolute inset-x-4 top-14 z-30 max-h-[calc(100vh-5rem)] overflow-y-auto p-2 text-ink shadow-lift"
          >
            {entries.map((entry) =>
              isGroup(entry) ? (
                <div key={entry.label} className="py-1">
                  <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    {entry.label}
                  </p>
                  {entry.items.map((item) => (
                    <DropdownLink
                      key={item.href}
                      item={item}
                      active={item.href === current}
                      onNavigate={close}
                    />
                  ))}
                </div>
              ) : (
                <DropdownLink
                  key={entry.href}
                  item={entry}
                  active={entry.href === current}
                  onNavigate={close}
                />
              ),
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

function DropdownLink({
  item,
  active,
  onNavigate,
}: {
  item: NavLink;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`block rounded-control px-4 py-2.5 transition-colors hover:bg-brand-tint focus-visible:bg-brand-tint focus-visible:outline-none ${
        active ? "bg-brand-tint" : ""
      }`}
    >
      <span className="block text-sm font-semibold text-brand-deep">{item.label}</span>
      {item.hint && <span className="block text-xs text-ink-soft">{item.hint}</span>}
    </Link>
  );
}
