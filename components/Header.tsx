"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { PRODUCT, formatMinor } from "@/config/funnel";
import { useHeroCtaPassed } from "@/lib/use-hero-cta-passed";

/**
 * Section links. Anchors resolve on the storefront home page only.
 *
 * `/guides` is the one entry that can leave this site. Once the guides and
 * blog move (lib/blog-migration.ts) it becomes an absolute URL on the new
 * domain, which is why it arrives as a prop rather than being written here:
 * this is a client component, and BLOG_ORIGIN is a RUNTIME server variable
 * with no NEXT_PUBLIC_ prefix, so it does not exist in the client bundle.
 * Resolving it here would silently always give the local path.
 */
const NAV = [
  { href: "/#product", label: "Product" },
  { href: "/guides", label: "Guides" },
  { href: "/faq", label: "Questions" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * Sticky header.
 *
 * TWO THINGS APPEAR CONDITIONALLY, FOR DIFFERENT REASONS.
 *
 * The compact CTA appears once the hero's own CTA has left the screen — it is
 * redundant while the real button is visible. That is now an observer on the
 * button itself (see lib/use-hero-cta-passed.ts) rather than a scroll
 * threshold, which was measurably wrong on a phone.
 *
 * The navigation collapses to a sheet below `lg`. It used to simply vanish:
 * `hidden lg:block` with nothing behind it, so on every phone and tablet the
 * header held the logo and nothing else, and Product, Questions and Contact
 * were reachable only by scrolling to the footer. The sheet drops from
 * the header rather than rising from the bottom edge, because the bottom edge
 * already belongs to the buy bar.
 *
 * Neither reveal changes layout: both boxes are always reserved, so nothing
 * shifts and nothing blocks a click mid-transition.
 */
export function Header({ guidesHref }: { guidesHref: string }) {
  const revealed = useHeroCtaPassed();
  // Required, not defaulted: a forgotten prop would quietly send every
  // visitor through a 301 instead of straight to the guides.
  const nav = NAV.map((n) => (n.href === "/guides" ? { ...n, href: guidesHref } : n));
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  // Escape closes and hands focus back to the control that opened it, so a
  // keyboard user is never left stranded inside a collapsed panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // The sheet's links are same-page anchors as often as they are routes, and
  // an anchor jump fires no navigation event — so close on activation rather
  // than waiting for a route change that may never come.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      // Once the real navigation is back, the sheet has no reason to exist.
      if (window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="shell-wide flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" aria-label={`${brand.name} — home`} className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo} alt="" width={30} height={30} className="h-[30px] w-[30px]" />
          <span className="font-display text-xl font-bold tracking-tight text-ink">
            {brand.name}
          </span>
        </Link>

        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="text-sm font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="/#buy"
            className="btn-cta reveal-cta hidden !min-h-[44px] !w-auto !px-5 !text-sm sm:inline-flex"
            data-shown={revealed ? "true" : "false"}
            // Hidden from assistive tech and from tab order until it is actually
            // visible, so a keyboard user never lands on an invisible control.
            aria-hidden={!revealed}
            tabIndex={revealed ? undefined : -1}
          >
            Buy now — {formatMinor(PRODUCT.unitPriceMinor)}
          </a>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            className="btn-quiet !min-h-[44px] !w-11 !px-0 lg:hidden"
          >
            <MenuMark open={open} />
          </button>
        </div>
      </div>

      {/* The sheet. `grid-template-rows: 0fr → 1fr` animates to the content's
          own height with no measurement and no layout thrash — the same
          technique the FAQ rows use, so the page has one way of opening a
          panel rather than two.

          Absolutely positioned, so opening it lays over the page instead of
          pushing the hero down the screen — which, because the buy bar
          watches the hero's CTA, would otherwise shove that CTA out of view
          and summon the bar underneath the open menu. */}
      <div
        id={panelId}
        className="sheet-drop absolute inset-x-0 top-full lg:hidden"
        data-open={open ? "true" : "false"}
      >
        <div className="overflow-hidden">
          <nav aria-label="Sections" className="border-b border-line bg-paper shadow-panel">
            <ul className="shell-wide divide-y divide-line">
              {nav.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => close(false)}
                    tabIndex={open ? undefined : -1}
                    className="flex min-h-[56px] items-center text-base font-medium text-ink"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="shell-wide py-4">
              <a
                href="/#buy"
                onClick={() => close(false)}
                tabIndex={open ? undefined : -1}
                className="btn-cta sm:max-w-xs"
              >
                Buy now &mdash; {formatMinor(PRODUCT.unitPriceMinor)}
              </a>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

/**
 * Two rules that become a cross. Drawn rather than borrowed: the storefront
 * has no icon library, and one 16px mark at the same 1.75 stroke as the FAQ
 * marker keeps the page to a single drawn weight.
 */
function MenuMark({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2 6h14"
        stroke="var(--color-ink)"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="origin-center transition-transform duration-200"
        style={{
          transitionTimingFunction: "var(--ease-out)",
          transform: open ? "translateY(3px) rotate(45deg)" : "none",
        }}
      />
      <path
        d="M2 12h14"
        stroke="var(--color-ink)"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="origin-center transition-transform duration-200"
        style={{
          transitionTimingFunction: "var(--ease-out)",
          transform: open ? "translateY(-3px) rotate(-45deg)" : "none",
        }}
      />
    </svg>
  );
}
