import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { Photo } from "@/brands/beauty/components/Photo";
import { SealedLine } from "@/brands/beauty/components/Wordmark";
import { NOT_FOUND } from "@/brands/beauty/copy/site";
import { IMAGES } from "@/brands/beauty/copy/images";
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
    <main id="main" className="au-wrap pt-8 md:pt-14">
      <div className="grid items-center gap-12 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-16">
        <div>
          <h1 className="au-display max-w-[12ch] text-[clamp(2.75rem,1.9rem+3vw,4.75rem)]">
            <SealedLine text={`${NOT_FOUND.title}.`} />
          </h1>
          <p className="au-lead mt-6">{NOT_FOUND.body}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link href="/#essentials" className="btn-cta">
              {NOT_FOUND.shop}
            </Link>
            <Link href="/" className="au-link inline-flex min-h-11 items-center font-semibold">
              {NOT_FOUND.home}
            </Link>
          </div>
        </div>
        <div className="au-frame aspect-square">
          <Photo image={IMAGES.vial} fill sizes="(min-width: 768px) 40vw, 100vw" />
        </div>
      </div>
    </main>
  );
}
