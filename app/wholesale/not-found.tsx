import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { NOT_FOUND } from "@/brands/wholesale/copy/pages";
import { Lockup } from "@/brands/wholesale/components/logo";
import { Bars } from "@/brands/wholesale/components/bars";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree. A label with nothing to ship: the band, the
 * words, the bars, and the way back to the product page.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main id="main" className="bk-page bk-wrap pt-10 md:pt-20">
      <div className="bk-label mx-auto max-w-xl">
        <div className="bk-label-band">
          <Lockup className="bk-lockup-footer" />
          <span className="bk-label-band-title">{NOT_FOUND.code}</span>
          <span className="bk-label-block" aria-hidden="true" />
        </div>
        <div className="px-5 pb-6 pt-7 md:px-7">
          <h1 className="bk-page-title">{NOT_FOUND.title}</h1>
          <p className="bk-page-lede">{NOT_FOUND.body}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/" className="btn-cta bk-btn-lg">
              {NOT_FOUND.home}
            </Link>
            <Link href="/contact" className="bk-btn-outline bk-btn-lg">
              {NOT_FOUND.contact}
            </Link>
          </div>
        </div>
        <div className="bk-label-foot border-t border-line">
          <Bars seed="not-found" className="bk-bars" />
        </div>
      </div>
    </main>
  );
}
