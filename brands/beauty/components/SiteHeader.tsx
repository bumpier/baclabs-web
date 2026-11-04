import Link from "next/link";
import { NAV } from "@/brands/beauty/copy/site";
import { BasketLink } from "./BasketLink";

/**
 * The header: the wordmark with its mark (a vial top seen from above, as in
 * the icon), three links and the basket. No menu button: three links fit on
 * a phone as a second row, and need no script.
 */
export function SiteHeader({ name }: { name: string }) {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 pt-5 sm:px-8 sm:pt-7">
      <Link href="/" aria-label={NAV.home} className="inline-flex items-center gap-2.5 rounded-full">
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
          <circle cx="16" cy="16" r="15" fill="#3B1730" />
          <circle cx="16" cy="16" r="9" fill="none" stroke="#E6BCAB" strokeWidth="2.6" />
          <ellipse cx="13.2" cy="12.6" rx="3" ry="1.8" fill="#FFFFFF" opacity="0.25" />
        </svg>
        <span className="font-display text-[1.875rem] leading-none tracking-[-0.01em]">{name}</span>
      </Link>
      <nav aria-label={NAV.label} className="order-3 w-full sm:order-none sm:ml-auto sm:w-auto">
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9375rem] font-semibold">
          <li>
            <Link href="/#essentials" className="inline-flex min-h-11 items-center hover:underline hover:decoration-rose hover:underline-offset-4">
              {NAV.essentials}
            </Link>
          </li>
          <li>
            <Link href="/clinics" className="inline-flex min-h-11 items-center hover:underline hover:decoration-rose hover:underline-offset-4">
              {NAV.clinics}
            </Link>
          </li>
          <li>
            <Link href="/contact" className="inline-flex min-h-11 items-center hover:underline hover:decoration-rose hover:underline-offset-4">
              {NAV.contact}
            </Link>
          </li>
        </ul>
      </nav>
      <BasketLink />
    </header>
  );
}
