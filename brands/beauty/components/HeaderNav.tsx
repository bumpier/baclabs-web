"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useBrandPathname } from "@/lib/brand/use-brand-pathname";
import { NAV } from "@/brands/beauty/copy/site";
import { CloseIcon, MenuIcon } from "./icons";

const LINKS = [
  { href: "/#essentials", label: NAV.shop, full: NAV.menuLinks.shop, page: null },
  { href: "/#ritual", label: NAV.ritual, full: NAV.menuLinks.ritual, page: null },
  { href: "/clinics", label: NAV.clinics, full: NAV.menuLinks.clinics, page: "/clinics" },
] as const;

/**
 * The header's left side. On a wide screen, the three links; on a phone, a
 * Menu button opening a porcelain sheet under the header with every link in
 * full words, Contact included. The sheet closes on a choice, on Esc, on a
 * tap outside it, and when the page changes. The page you are on is marked
 * (aria-current), with the seal on the phone.
 */
export function HeaderNav() {
  const pathname = useBrandPathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const current = (page: string | null) => (page !== null && pathname === page ? "page" : undefined);

  return (
    <div ref={root}>
      <nav aria-label={NAV.label} className="hidden lg:block">
        <ul className="flex items-center gap-x-7">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="bb-nav" aria-current={current(l.page)}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="lg:hidden">
        <button
          ref={button}
          type="button"
          className="bb-icon-btn -ml-2.5"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
          <span className="sr-only">{open ? NAV.closeMenu : NAV.menu}</span>
        </button>
        {open ? (
          <nav id={panelId} aria-label={NAV.label} className="bb-menu">
            <ul>
              {[...LINKS, { href: "/contact", label: NAV.contact, full: NAV.menuLinks.contact, page: "/contact" }].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="bb-menu-link" aria-current={current(l.page)} onClick={() => setOpen(false)}>
                    {l.full}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

/** The header's Contact link, on wide screens (the phone's menu holds it). */
export function ContactLink() {
  const pathname = useBrandPathname();
  return (
    <Link href="/contact" className="bb-nav hidden lg:inline-flex" aria-current={pathname === "/contact" ? "page" : undefined}>
      {NAV.contact}
    </Link>
  );
}
