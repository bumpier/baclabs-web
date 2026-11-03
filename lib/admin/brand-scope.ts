import type { Prisma } from "@prisma/client";
import { allBrands } from "@/brands/registry";

/**
 * Which brand the admin is looking at: one brand, or every brand at once.
 *
 * One admin serves every brand. Its order, finance and mailing-list pages
 * show the brand scope's rows only, and the switcher in the admin header
 * (components/admin/BrandSwitcher.tsx) sets it. In order of precedence:
 *
 *   1. `?brand=` on the URL, so a link can show one brand without changing
 *      the admin's own choice (the dashboard's per-brand tiles use it);
 *   2. the `admin_brand` cookie the switcher sets;
 *   3. "all".
 *
 * A value that names no registered brand is ignored at each step, so a
 * stale cookie or a mistyped link falls through rather than showing nothing.
 *
 * "all" adds no condition at all, so with one brand registered every query
 * is exactly what it was before brands existed.
 */

/** Every brand at once. Never a brand id. */
export const ALL_BRANDS_SCOPE = "all";

/** "all", or a registered brand's id (a test fixture's included). */
export type BrandScope = typeof ALL_BRANDS_SCOPE | (string & {});

export const ADMIN_BRAND_COOKIE = "admin_brand";
/** The switcher's choice outlives the session: a year. */
export const ADMIN_BRAND_COOKIE_MAX_AGE = 365 * 24 * 3600;

/** "all" or a registered brand's id. */
export function isBrandScope(value: unknown): value is BrandScope {
  if (value === ALL_BRANDS_SCOPE) return true;
  return typeof value === "string" && allBrands().some((b) => b.id === value);
}

type ParamValue = string | string[] | null | undefined;

/** A search param's first value, or null. */
function first(value: ParamValue): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v : null;
}

/** The `?brand=` value when it names a scope, else null. */
export function brandParam(param: ParamValue): BrandScope | null {
  const v = first(param);
  return isBrandScope(v) ? v : null;
}

/** ?brand= wins, then the cookie, then every brand. Pure, for the tests. */
export function parseBrandScope(param: ParamValue, cookie: string | null | undefined): BrandScope {
  return brandParam(param) ?? (isBrandScope(cookie) ? cookie : ALL_BRANDS_SCOPE);
}

/**
 * The scope of the request being served, for server components and route
 * handlers: pass the page's `brand` search param. Outside a request (a
 * script) there is no cookie, so it is the param or "all".
 */
export async function adminBrandScope(param?: ParamValue): Promise<BrandScope> {
  let cookie: string | undefined;
  try {
    const { cookies } = await import("next/headers");
    cookie = (await cookies()).get(ADMIN_BRAND_COOKIE)?.value;
  } catch {
    cookie = undefined;
  }
  return parseBrandScope(param, cookie);
}

/**
 * `{ brand }` for one brand, `{}` for every brand: spread into any where
 * clause on a table with a brand column (orders, plans, subscribers, gifts,
 * campaigns, messages).
 */
export function brandWhere(scope: BrandScope): { brand?: string } {
  return scope === ALL_BRANDS_SCOPE ? {} : { brand: scope };
}

/**
 * An order where clause in the brand scope. Every admin query on orders goes
 * through this, so no page can forget the brand. For "all" it returns the
 * filters it was given, untouched.
 */
export function ordersWhere({
  brand,
  ...where
}: Omit<Prisma.OrderWhereInput, "brand"> & { brand: BrandScope }): Prisma.OrderWhereInput {
  return { ...where, ...brandWhere(brand) };
}

/**
 * `href` with the page's own `?brand=` carried on, so a link shows the brand
 * the page shows. With no param (the cookie decides) it is left alone.
 */
export function keepBrandParam(param: ParamValue): (href: string) => string {
  const brand = brandParam(param);
  return (href) => {
    if (!brand) return href;
    const [path, hash] = href.split("#", 2);
    const sep = path!.includes("?") ? "&" : "?";
    return `${path}${sep}brand=${encodeURIComponent(brand)}${hash !== undefined ? `#${hash}` : ""}`;
  };
}

/**
 * Where the switcher goes once the cookie is set: the admin page it was used
 * on, with that page's own ?brand= dropped, since it would outrank the new
 * choice. Anything that is not a path inside /admin is /admin, so the form's
 * `next` field cannot send anyone off the site.
 */
export function afterBrandSwitch(next: string | null | undefined): string {
  const fallback = "/admin";
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  const base = "http://admin.invalid";
  const url = new URL(next, base);
  if (url.origin !== base || !(url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) return fallback;
  url.searchParams.delete("brand");
  return `${url.pathname}${url.search}`;
}

/** Registry order, BacLab first; an id no longer registered sorts last. For grouping rows by brand. */
export function brandRank(id: string): number {
  const i = allBrands().findIndex((b) => b.id === id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
