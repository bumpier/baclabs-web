import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { SITE } from "@/brands/gym/copy/site";
import { brand, STOREFRONT } from "./site";

const LINKS = [
  { href: "/contact", label: SITE.links.contact },
  { href: "/terms", label: SITE.links.terms },
  { href: "/privacy", label: SITE.links.privacy },
  { href: "/returns", label: SITE.links.returns },
  { href: "/disclaimer", label: SITE.links.disclaimer },
];

/**
 * The footer on every page: the legal pages, the contact page and "Cookie
 * settings", as the law and the cookie banner's promise need, the product
 * disclaimer, and the wordmark at full width to close the page. The phone's
 * buy bar steps aside while this is in view (#site-footer).
 */
export function SiteFooter() {
  return (
    <footer id="site-footer" className="gym-footer gym-rubber">
      <div className="gym-hazard gym-hazard-thin" aria-hidden="true" />
      <div className="gym-wrap">
        <nav aria-label={SITE.footerNav}>
          <ul className="gym-footer-links">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="gym-footer-link">
                  {l.label}
                </Link>
              </li>
            ))}
            <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id} className="gym-footer-link">
              {SITE.cookieSettings}
            </CookieSettingsButton>
          </ul>
        </nav>
        <p className="gym-footer-disclaimer">{brand.disclaimer}</p>
        {brand.legalName ? <p className="gym-footer-disclaimer">{brand.legalName}</p> : null}
        <p className="gym-footer-mark" aria-hidden="true">
          {brand.name}
        </p>
      </div>
    </footer>
  );
}
