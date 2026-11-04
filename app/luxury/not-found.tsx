import type { Metadata } from "next";
import Link from "next/link";
import { brandNotFoundMetadata } from "@/lib/brand/site";
import { brand, DESCRIPTION } from "./site";

/**
 * The brand's 404, for every path its tree does not have (the catch-all in
 * [...missing] sends them here) and for its /admin, which middleware.ts
 * rewrites into this tree.
 */
export const metadata: Metadata = brandNotFoundMetadata(brand, DESCRIPTION);

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-24">
      <p className="text-sm uppercase tracking-widest text-ink-soft">404</p>
      <h1 className="mt-3 font-display text-4xl text-ink">Page not found</h1>
      <p className="mt-4 text-ink-soft">That address does not exist on this site.</p>
      <p className="mt-8">
        <Link href="/" className="text-ink underline underline-offset-4">
          Back to the home page
        </Link>
      </p>
    </main>
  );
}
