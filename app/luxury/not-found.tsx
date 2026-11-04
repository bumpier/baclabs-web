import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { BoxDrawing } from "@/brands/luxury/components/BoxDrawing";
import { NOT_FOUND } from "@/brands/luxury/copy/site";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree. The box, closed.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main id="main" className="rx-wrap">
      <div className="rx-missing">
        <BoxDrawing open={false} card={false} idPrefix="rx-box-closed" className="rx-missing__art" />
        <h1 className="rx-page__heading">{NOT_FOUND.heading}</h1>
        <p className="rx-page__lede">{NOT_FOUND.body}</p>
        <p>
          <Link href="/" className="rx-link">
            {NOT_FOUND.home}
          </Link>
        </p>
      </div>
    </main>
  );
}
