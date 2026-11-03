"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setAdminBrandAction } from "@/app/admin/actions";

export interface BrandOption {
  /** "all" or a brand id (lib/admin/brand-scope.ts). */
  id: string;
  label: string;
}

/**
 * Which brand the admin shows: All brands or one of them. Choosing one saves
 * it in the admin_brand cookie (setAdminBrandAction) and reloads the page in
 * that brand. A page opened with its own ?brand= shows that brand, so the
 * select does too; switching drops the param.
 *
 * Takes the brands as props: a client component never imports the registry.
 */
export function BrandSwitcher({ options, current }: { options: BrandOption[]; current: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get("brand");
  const selected = fromUrl && options.some((o) => o.id === fromUrl) ? fromUrl : current;
  const query = params.toString();

  return (
    <form action={setAdminBrandAction} className="flex items-center">
      <input type="hidden" name="next" value={query ? `${pathname}?${query}` : pathname} />
      <label htmlFor="admin-brand" className="sr-only">
        Brand
      </label>
      {/* Keyed so it follows the page when a link changes the brand. */}
      <select
        key={selected}
        id="admin-brand"
        name="brand"
        defaultValue={selected}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-[11rem] cursor-pointer rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm text-white/75 hover:text-white">
          Show
        </button>
      </noscript>
    </form>
  );
}
