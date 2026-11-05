import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { SITE } from "@/brands/gym/copy/site";
import { Mark, Wordmark } from "@/brands/gym/components/Logo";
import { tradingAs } from "@/lib/commerce/legal";
import { brand, STOREFRONT } from "./site";

const COLUMNS = [
  {
    heading: SITE.footer.shop,
    links: [
      { href: "/#shop", label: SITE.links.shop },
      { href: "/#maths", label: SITE.links.maths },
      { href: "/#faq", label: SITE.links.faq },
    ],
  },
  {
    heading: SITE.footer.help,
    links: [
      { href: "/contact", label: SITE.links.contact },
      { href: "/returns", label: SITE.links.returns },
    ],
  },
  {
    heading: SITE.footer.legal,
    links: [
      { href: "/terms", label: SITE.links.terms },
      { href: "/privacy", label: SITE.links.privacy },
      { href: "/disclaimer", label: SITE.links.disclaimer },
    ],
    cookies: true,
  },
];

/**
 * The footer on every page: the hazard band, the mark and a sign-off, three
 * short columns of links (the legal pages, the contact page and "Cookie
 * settings", as the law and the cookie banner's promise need), the product
 * disclaimer, and the wordmark across the full width to close the page. The
 * phone's add-to-cart bar steps aside while this is in view (#site-footer).
 */
export function SiteFooter() {
  return (
    <footer id="site-footer" className="gym-footer">
      <div className="gym-tape" aria-hidden="true" />
      <div className="gym-wrap gym-footer-grid">
        <div className="gym-footer-brand">
          <Mark className="gym-footer-mark" />
          <p className="gym-footer-signoff">{SITE.footer.signoff}</p>
        </div>
        <nav aria-label={SITE.footer.nav} className="gym-footer-nav">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="gym-footer-heading">{col.heading}</h2>
              <ul className="gym-footer-links">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="gym-footer-link">
                      {l.label}
                    </Link>
                  </li>
                ))}
                {col.cookies ? (
                  <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id} className="gym-footer-link">
                    {SITE.cookieSettings}
                  </CookieSettingsButton>
                ) : null}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="gym-wrap">
        <p className="gym-footer-small">{brand.disclaimer}</p>
        {brand.legalName ? <p className="gym-footer-small">{tradingAs(brand)}.</p> : null}
      </div>
      <div className="gym-wrap gym-footer-word" aria-hidden="true">
        <Wordmark className="gym-footer-wordmark" />
      </div>
    </footer>
  );
}
