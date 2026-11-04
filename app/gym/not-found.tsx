import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { NOT_FOUND } from "@/brands/gym/copy/site";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree. The code is stencilled big, the way to the packs
 * one button away.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="gym-page gym-rubber outline-none">
      <div className="gym-wrap">
        <p className="gym-figure text-[clamp(7rem,40vw,20rem)] leading-[0.8] text-primary" aria-hidden="true">
          {NOT_FOUND.code}
        </p>
        <h1 className="gym-page-title mt-6">{NOT_FOUND.heading}</h1>
        <p className="gym-page-lead">{NOT_FOUND.lead}</p>
        <p className="mt-8">
          <Link href="/" className="gym-btn gym-btn-lg">
            {NOT_FOUND.back}
          </Link>
        </p>
      </div>
    </main>
  );
}
