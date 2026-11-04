/**
 * A brand's logo as a data: URI, read from public/<id>/ on the server, for
 * pages that show another brand's logo on BacLab's domain: the packing slip
 * in the admin (components/admin/PackingSlip.tsx).
 *
 * Why not its URL: a brand's logo is served on the brand's own domain (the
 * host rewrite maps /icon.svg to public/<id>/icon.svg). On baclab.co.uk that
 * path is BacLab's own file, and loading it from the brand's domain would
 * need the admin's CSP to list every brand's domain in a header anyone can
 * read on baclab.co.uk, tying the brands together. Inlined, the slip needs
 * only img-src data:, which the CSP has always allowed.
 *
 * SERVER CODE (node:fs). Read once per logo and kept for the process's life.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrandProfile } from "@/brands/types";

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const cache = new Map<string, string | null>();

/**
 * `data:<type>;base64,...` for the brand's `logo` (a site path such as
 * "/icon.svg"), or null when it is not a local file of a known image type,
 * or cannot be read. The path cannot leave the brand's own public folder.
 */
export function brandLogoDataUri(brand: Pick<BrandProfile, "id" | "logo">): string | null {
  const key = `${brand.id}:${brand.logo}`;
  const known = cache.get(key);
  if (known !== undefined) return known;

  let uri: string | null = null;
  const type = TYPES[path.extname(brand.logo).toLowerCase()];
  if (brand.logo.startsWith("/") && type) {
    const folder = path.join(process.cwd(), "public", brand.id);
    const file = path.resolve(folder, `.${brand.logo}`);
    if (file.startsWith(`${folder}${path.sep}`)) {
      try {
        uri = `data:${type};base64,${readFileSync(file).toString("base64")}`;
      } catch {
        uri = null;
      }
    }
  }
  cache.set(key, uri);
  return uri;
}
