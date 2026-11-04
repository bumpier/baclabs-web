import Link from "next/link";
import { SITE } from "@/brands/gym/copy/site";
import { CartButton } from "./CartButton";
import { Lockup } from "./Logo";

const NAV = [
  { href: "/#shop", label: SITE.links.shop },
  { href: "/#maths", label: SITE.links.maths },
  { href: "/#faq", label: SITE.links.faq },
  { href: "/contact", label: SITE.links.contact },
];

/**
 * The header on every page, stuck to the top of the screen: a skip link, the
 * mark and wordmark home on the left, a short nav (the shop link alone on a
 * phone; the footer carries the rest there), and the cart on the right.
 * Server-rendered; only the cart button is client code.
 */
export function Header({ name }: { name: string }) {
  return (
    <header className="gym-header">
      <a href="#main" className="gym-skip">
        {SITE.skip}
      </a>
      <div className="gym-wrap gym-header-row">
        <Link href="/" className="gym-home" aria-label={SITE.home(name)}>
          <Lockup />
        </Link>
        <nav aria-label={SITE.nav} className="gym-nav">
          <ul>
            {NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="gym-nav-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <CartButton />
      </div>
    </header>
  );
}
