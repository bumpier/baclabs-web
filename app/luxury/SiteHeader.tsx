import Link from "next/link";
import { NAV } from "@/brands/luxury/copy/site";
import { BasketCount } from "./BasketCount";
import { brand } from "./site";

/**
 * Every page's header: the skip link, the wordmark home and two ways in, to
 * the order (the home page's buy section, #buy) and to the concierge. A
 * server component; only the basket count beside "Order" runs in the browser.
 */
export function SiteHeader() {
  return (
    <header className="rx-header">
      <a href="#main" className="rx-skip">
        {NAV.skip}
      </a>
      <div className="rx-wrap rx-header__inner">
        <Link href="/" className="rx-wordmark">
          {brand.name}
        </Link>
        <nav aria-label={NAV.label} className="rx-nav">
          <ul>
            <li>
              <Link href="/#buy">
                {NAV.order}
                <BasketCount />
              </Link>
            </li>
            <li>
              <Link href="/contact">{NAV.concierge}</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
