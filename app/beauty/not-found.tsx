import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { NOT_FOUND } from "@/brands/beauty/copy/site";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree. It renders inside the root layout, so the
 * header, the basket and the footer are all still there.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex max-w-2xl flex-col items-start px-5 pb-8 pt-16 sm:px-8 md:pt-24">
      <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill="#F2DFDC" />
        <circle cx="24" cy="24" r="12" fill="none" stroke="#B9877A" strokeWidth="3" />
      </svg>
      <h1 className="au-display mt-8 text-[clamp(2.5rem,1.9rem+2.4vw,3.75rem)]">{NOT_FOUND.title}</h1>
      <p className="au-lead mt-5">{NOT_FOUND.body}</p>
      <Link href="/" className="btn-cta mt-9">
        {NOT_FOUND.home}
      </Link>
    </main>
  );
}
