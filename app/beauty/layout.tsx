import type { Metadata, Viewport } from "next";
import { BrandPathnameProvider } from "@/lib/brand/use-brand-pathname";
import { brandRootMetadata, brandViewport } from "@/lib/brand/site";
import { brand, DESCRIPTION, LIVE } from "./site";
import "@/brands/beauty/styles.css";

/**
 * The brand's own root layout: its stylesheet, its metadata, nothing of
 * BacLab's. Bounded like BacLab's store layout, so no cache in front can
 * hold a page (and its prices) for more than five minutes.
 */
export const revalidate = 300;

export const metadata: Metadata = brandRootMetadata(brand, { description: DESCRIPTION, live: LIVE });

export const viewport: Viewport = brandViewport(brand);

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <BrandPathnameProvider id={brand.id}>{children}</BrandPathnameProvider>
      </body>
    </html>
  );
}
