import { notFound } from "next/navigation";

/**
 * Every path this brand's tree does not have. Without it an unmatched path
 * would fall through to app/global-not-found.tsx, which is BacLab's 404. It
 * is the lowest-priority match in the tree, so it never shadows a page or a
 * route here. Dynamic, so a 404 is never prerendered or cached as a page.
 */
export const dynamic = "force-dynamic";

export default function Missing(): never {
  notFound();
}
