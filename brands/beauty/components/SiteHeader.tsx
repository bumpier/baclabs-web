import Link from "next/link";
import { NAV } from "@/brands/beauty/copy/site";
import { BasketButton } from "./BasketButton";
import { ContactLink, HeaderNav } from "./HeaderNav";
import { Wordmark } from "./Wordmark";

/**
 * The announcement line, then the header, which stays at the top as the
 * page scrolls: the links on the left (a Menu button on a phone), the
 * wordmark in the middle, Contact and the basket on the right. The basket
 * opens as a drawer on every page.
 *
 * `announcement` is the free-delivery line and its cutoff, written by the
 * layout from the catalogue's own figures (copy/home.ts announcement); null
 * shows none.
 */
export function SiteHeader({ announcement }: { announcement: { offer: string; cutoff: string | null } | null }) {
  return (
    <>
      {announcement ? (
        <p className="au-announce no-print">
          {announcement.offer}
          {announcement.cutoff ? <span className="hidden sm:inline"> {announcement.cutoff}</span> : null}
        </p>
      ) : null}
      <header className="au-header no-print">
        <div className="au-wrap au-header-row">
          <div className="justify-self-start">
            <HeaderNav />
          </div>
          <Link href="/" aria-label={NAV.home} className="justify-self-center rounded-md">
            <Wordmark className="au-wordmark" />
          </Link>
          <div className="flex items-center gap-x-5 justify-self-end">
            <ContactLink />
            <BasketButton />
          </div>
        </div>
      </header>
    </>
  );
}
