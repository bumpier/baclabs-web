import Link from "next/link";
import { SITE } from "@/brands/gym/copy/site";
import { BasketLink } from "./BasketLink";

/**
 * The header on every page: a skip link, the stencilled wordmark home, and
 * the basket. Nothing else, on purpose: the site is one product in four
 * sizes, and the page below is the menu. Server-rendered; only the basket
 * count is client code.
 */
export function Header({ name }: { name: string }) {
  return (
    <header className="gym-header">
      <a href="#main" className="gym-skip">
        {SITE.skip}
      </a>
      <div className="gym-wrap gym-header-row">
        <Link href="/" className="gym-wordmark" aria-label={SITE.home(name)}>
          {name}
        </Link>
        <BasketLink />
      </div>
    </header>
  );
}
