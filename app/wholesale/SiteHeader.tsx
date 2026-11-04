import Link from "next/link";
import { utilityFacts } from "@/brands/wholesale/copy/home";
import { HEADER, NAV } from "@/brands/wholesale/copy/pages";
import { Lockup } from "@/brands/wholesale/components/logo";
import { STOREFRONT } from "./site";
import { OrderButton } from "./OrderButton";

/**
 * The utility bar and the header. The bar carries three true facts (the
 * cutoff is the view's own field); the header the lockup, the five links
 * and the order button with the order's vial count, and stays in view as
 * the page scrolls. On a phone the links fold into a menu (a native
 * disclosure, no script) and the bar keeps only its first fact.
 *
 * A server component: only the order button runs in the browser.
 */
export function SiteHeader() {
  const facts = utilityFacts(STOREFRONT);
  return (
    <>
      <div className="vh-util">
        <ul className="vh-wrap vh-util-row">
          {facts.map((f) => (
            <li key={f.text}>
              <UtilIcon name={f.icon} />
              <span className="vh-util-long">{f.text}</span>
              <span className="vh-util-short">{f.short}</span>
            </li>
          ))}
        </ul>
      </div>
      <header className="vh-header">
        <div className="vh-wrap vh-header-row">
          <Link href="/" className="vh-home" aria-label={HEADER.home}>
            <Lockup />
          </Link>
          <nav aria-label={HEADER.nav} className="vh-nav">
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="vh-header-actions">
            <OrderButton />
            <details className="vh-menu">
              <summary className="vh-menu-btn">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="sr-only">{HEADER.menu}</span>
              </summary>
              <nav aria-label={HEADER.nav} className="vh-menu-panel">
                <ul>
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}

function UtilIcon({ name }: { name: "clock" | "truck" | "building" }) {
  const d = {
    clock: "M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5Z M8 4.5V8l2.5 1.5",
    truck: "M1.5 4h8v7h-8z M9.5 6.5h3l2 2.5V11h-5z M4 13.25a1.25 1.25 0 1 0 0-.01 M11.5 13.25a1.25 1.25 0 1 0 0-.01",
    building: "M2 14.5V3.5l6-2v13 M8 5.5h6v9 M1 14.5h14 M4.5 5.5h1 M4.5 8h1 M4.5 10.5h1 M10.5 8h1 M10.5 10.5h1",
  }[name];
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false" className="vh-util-icon">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
