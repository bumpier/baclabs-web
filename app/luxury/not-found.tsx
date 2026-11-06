import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { Seal } from "@/brands/luxury/components/Marks";
import { photoProps } from "@/brands/luxury/components/photo";
import { GALLERY } from "@/brands/luxury/copy/images";
import { NOT_FOUND } from "@/brands/luxury/copy/site";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree. The first of the product's photographs beside
 * it, and the seal.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main id="main" className="rv-split">
      <figure className="rv-split__photo">
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/image's attributes, alt included (components/photo.ts) */}
        <img {...photoProps(GALLERY[0]!, { sizes: "(min-width: 960px) 50vw, 100vw" })} />
      </figure>
      <div className="rv-split__body">
        <Seal className="rv-missing__seal" />
        <h1 className="rv-page__heading">{NOT_FOUND.heading}</h1>
        <p className="rv-page__lede">{NOT_FOUND.body}</p>
        <p className="rv-missing__links">
          <Link href="/" className="rv-link">
            {NOT_FOUND.home}
          </Link>
          <Link href="/contact" className="rv-link">
            {NOT_FOUND.concierge}
          </Link>
        </p>
      </div>
    </main>
  );
}
