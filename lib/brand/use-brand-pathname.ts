"use client";

import { createContext, createElement, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The pathname as the visitor sees it, on any site.
 *
 * A brand's pages live under app/<id>/ and are reached by a host rewrite
 * (middleware.ts), so usePathname() disagrees with itself: it is
 * `/beauty/products` while the page prerenders and `/products` in the
 * browser. Anything rendered from it (an active link, a hidden banner) then
 * fails to hydrate. This strips the brand's prefix, so both sides read
 * `/products`.
 *
 * The prefix comes from BrandPathnameProvider in the brand's root layout,
 * never from a list of brands, so no brand's JavaScript names another. On
 * BacLab there is no provider and this is exactly usePathname().
 *
 * Use it in place of usePathname() in any component a brand renders.
 * (BacLab-only components may keep usePathname(); see AnnouncementBanner.)
 */

const BrandPrefix = createContext<string | null>(null);

/** Wraps a brand's tree, in its root layout, so useBrandPathname() knows its prefix. */
export function BrandPathnameProvider({ id, children }: { id: string; children: ReactNode }) {
  return createElement(BrandPrefix.Provider, { value: `/${id}` }, children);
}

/** `pathname` without a brand's `/<id>` prefix; unchanged when there is none. */
export function stripBrandPrefix(pathname: string, prefix: string | null): string {
  if (!prefix) return pathname;
  if (pathname === prefix) return "/";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

export function useBrandPathname(): string {
  return stripBrandPrefix(usePathname() ?? "/", useContext(BrandPrefix));
}
