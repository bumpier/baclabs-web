import Link from "next/link";
import { NAV } from "@/brands/wholesale/copy/pages";
import { brand } from "./site";

/**
 * The masthead: the wordmark and four links, on the steel band. A server
 * component; it carries no basket count, because the price list is the
 * order form and sits on the home page itself.
 */
export function SiteHeader() {
  return (
    <header className="wh-masthead">
      <div className="wh-wrap wh-masthead-row">
        <Link href="/" className="wh-wordmark">
          <Mark />
          <span>{brand.name}</span>
        </Link>
        <nav aria-label="Main" className="wh-nav">
          <ul>
            {NAV.map((item) => (
              <li key={item.href} className={item.wide ? "wh-nav-wide" : undefined}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

/** The site icon (public/wholesale/icon.svg) reversed for the dark band. */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" fill="#FFFFFF" />
      <path d="M7 7h4.6l4.4 11.2L20.4 7H25l-6.8 15h-4.4z" fill="#1E2A38" />
      <rect x="7" y="24" width="18" height="2" fill="#12784A" />
    </svg>
  );
}
