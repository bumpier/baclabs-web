/**
 * Which site a request is for, from its Host header alone. Used by
 * middleware.ts, so it must stay edge-safe: it reads brands/hosts.json and
 * nothing else, never the registry (which holds every brand's profile and
 * reads server env) and never Prisma.
 *
 * brands/hosts.json maps each brand's id to the hosts that serve it (apex
 * and www, lower-case, no port). BacLab is not in it: BacLab is whatever
 * host is not a brand's, which is how its mirror domains keep working.
 * A brand's profile reads its `domains` from the same file, so the
 * rewrite and brandFromHost() can never disagree.
 *
 * `<id>.localhost` is each brand's development host (browsers resolve every
 * *.localhost to 127.0.0.1). It stays listed after launch: no public DNS name
 * ends in .localhost, so it can only ever reach the app from this machine.
 */
import hosts from "@/brands/hosts.json";

/** id -> hosts, for every brand that is not BacLab. */
export const BRAND_HOSTS: Readonly<Record<string, readonly string[]>> = hosts;

/** The brand ids that own a tree under app/<id>. */
export const BRAND_TREE_IDS: readonly string[] = Object.keys(hosts);

/**
 * Where a direct request for a brand's internal path is sent on BacLab's
 * host. No route matches it, so app/global-not-found.tsx answers with
 * BacLab's 404.
 */
export const NOT_FOUND_PATH = "/_brand-path-not-found";

const HOST_TO_ID = new Map<string, string>(
  Object.entries(hosts).flatMap(([id, list]) => list.map((h) => [h, id] as const))
);

/** The bare host name: lower-case, port removed. */
export function hostName(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

/** The brand a Host header belongs to, or null for BacLab (and any unknown host). */
export function brandIdForHost(host: string | null | undefined): string | null {
  return HOST_TO_ID.get(hostName(host)) ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every brand host as one regex body, for the `has`/`missing` host conditions
 * in middleware.ts and next.config.js (Next anchors it as ^…$ and matches it
 * against the host without its port). middleware.ts must carry it as a
 * literal, because Next reads the matcher statically: `npm run test:hosts`
 * checks that literal against this.
 */
export function brandHostPattern(): string {
  return `(?:${[...HOST_TO_ID.keys()].map(escapeRegex).join("|")})`;
}

/** /beauty, /beauty/…: a brand's internal tree, never a public URL. */
function isBrandTreePath(pathname: string): boolean {
  return BRAND_TREE_IDS.some((id) => pathname === `/${id}` || pathname.startsWith(`/${id}/`));
}

/**
 * Where middleware sends a request: the path to rewrite it to, or null to
 * let it through untouched.
 *
 *   - On a brand host, every path is served from that brand's tree, dotted
 *     ones included (robots.txt, icon.svg, public/<id>/ files), so the
 *     brand never gets BacLab's robots, sitemap, llms.txt or favicon. Its
 *     /admin lands in its tree too, where nothing matches: a 404 in the
 *     brand's own style. /_next and /api are shared and pass through.
 *   - On any other host, a brand's tree requested directly (/beauty/…) is
 *     a 404, so a brand never shows on BacLab's domain.
 */
export function brandRewrite(host: string | null | undefined, pathname: string): string | null {
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/")) return null;
  const id = brandIdForHost(host);
  if (id) return pathname === "/" ? `/${id}` : `/${id}${pathname}`;
  if (isBrandTreePath(pathname)) return NOT_FOUND_PATH;
  return null;
}
