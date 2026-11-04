import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { NOT_FOUND } from "@/brands/wholesale/copy/pages";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree. A short label on the slate ground, its title in
 * the steel bar, pointing back to the price list.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main id="main" className="wh-wrap py-12 md:py-20">
      <div className="wh-label mx-auto max-w-xl">
        <h1 className="wh-label-head text-xl">{NOT_FOUND.title}</h1>
        <div className="px-5 py-6 md:px-7">
          <p className="text-ink-soft">{NOT_FOUND.body}</p>
          <p className="mt-6">
            <Link href="/" className="btn-cta">
              {NOT_FOUND.home}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
