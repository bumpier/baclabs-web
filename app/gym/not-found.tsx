import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { NOT_FOUND } from "@/brands/gym/copy/site";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree. The code is stencilled huge in hazard yellow over
 * the black, the way back to the shop one button away.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="gym-lost outline-none">
      <div className="gym-wrap gym-lost-inner">
        <p className="gym-lost-code" aria-hidden="true">
          404
        </p>
        <h1 className="gym-page-title">{NOT_FOUND.heading}</h1>
        <p className="gym-page-lead">{NOT_FOUND.lead}</p>
        <Link href="/#shop" className="gym-btn gym-btn-hazard gym-btn-lg">
          {NOT_FOUND.back}
        </Link>
      </div>
    </main>
  );
}
