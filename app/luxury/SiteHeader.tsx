import Link from "next/link";
import { Wordmark } from "@/brands/luxury/components/Marks";
import { ANNOUNCE, NAV } from "@/brands/luxury/copy/site";
import { serviceFacts } from "@/brands/luxury/service";
import { BagButton } from "./Bag";
import { brand, STOREFRONT } from "./site";

/**
 * Every page's top: one line of the delivery every order gets (from the
 * catalogue, through brands/luxury/service.ts), then the header, which stays
 * at the top as the page scrolls. The wordmark sits in the centre; a few
 * words either side; the bag on the right opens the drawer (app/luxury/
 * Bag.tsx). A server component: only the bag button runs in the browser.
 */
export function SiteHeader() {
  const facts = serviceFacts(STOREFRONT);
  return (
    <>
      <a href="#main" className="rv-skip">
        {NAV.skip}
      </a>
      {facts ? (
        <div className="rv-announce">
          <p>{ANNOUNCE(facts)}</p>
        </div>
      ) : null}
      <header className="rv-header">
        <nav aria-label={NAV.label} className="rv-header__inner">
          <ul className="rv-header__links">
            <li>
              <Link href="/#buy">{NAV.shop}</Link>
            </li>
            <li className="rv-wide-only">
              <Link href="/#vial">{NAV.vial}</Link>
            </li>
          </ul>
          <Link href="/" className="rv-header__mark" aria-label={NAV.home(brand.name)}>
            <Wordmark className="rv-header__wordmark" />
          </Link>
          <ul className="rv-header__links rv-header__links--end">
            <li className="rv-wide-only">
              <Link href="/contact">{NAV.concierge}</Link>
            </li>
            <li>
              <BagButton />
            </li>
          </ul>
        </nav>
      </header>
    </>
  );
}
