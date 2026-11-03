import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { allBrands } from "@/brands/registry";
import { getAdminSession } from "@/lib/adminAuth";
import { adminBrandScope, ALL_BRANDS_SCOPE } from "@/lib/admin/brand-scope";
import { adminLogoutAction } from "@/app/admin/actions";
import { AdminNav, type NavEntry, type NavLink } from "@/components/admin/AdminNav";
import { BrandSwitcher, type BrandOption } from "@/components/admin/BrandSwitcher";

// robots.txt already disallows /admin/, but a disallow stops crawling, not
// indexing: a URL linked from elsewhere can still appear as a bare result.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Gated<T> = T & { adminOnly?: boolean };

// Packers only ever see Orders; everything else, money included, is Admin-only.
const ALL_NAV: Gated<NavLink | { label: string; items: Gated<NavLink>[] }>[] = [
  { href: "/admin", label: "Overview", adminOnly: true },
  {
    label: "Orders",
    items: [
      { href: "/admin/orders", label: "All orders", hint: "Pick, pack and dispatch" },
      { href: "/admin/orders/scan", label: "Scan station", hint: "Check a parcel against its order" },
      { href: "/admin/plans", label: "Monthly plans", hint: "Prepaid boxes, cancellations and refunds", adminOnly: true },
      { href: "/admin/messages", label: "Customer messages", hint: "From the contact form", adminOnly: true },
      { href: "/admin/free-vials", label: "Free vials", hint: "Added to a customer's next order", adminOnly: true },
    ],
  },
  {
    label: "Finance",
    adminOnly: true,
    items: [
      { href: "/admin/finance", label: "Overview", hint: "Takings, shipping costs and charts" },
      { href: "/admin/takings", label: "Daily takings", hint: "One day, order by order" },
      { href: "/admin/finance/costs", label: "Costs", hint: "Postage, fulfilment and VAT" },
      { href: "/admin/export", label: "Export", hint: "Sales as a CSV, up to all time" },
    ],
  },
  {
    label: "Catalogue",
    adminOnly: true,
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/products/new", label: "Add a product" },
      { href: "/admin/content", label: "Content", hint: "Articles and guides" },
    ],
  },
  {
    label: "Warehouse",
    adminOnly: true,
    items: [
      { href: "/admin/stock", label: "Vial stock", hint: "Left, sent out and deliveries" },
      { href: "/admin/inventory", label: "Inventory", hint: "Stock levels by SKU" },
      { href: "/admin/inventory/stock", label: "Book stock in / adjust" },
      { href: "/admin/inventory/warehouses", label: "Warehouses & locations" },
      { href: "/admin/inventory/skus/new", label: "New SKU" },
      { href: "/admin/shipping", label: "Shipping", hint: "SmartTrack and postal services" },
    ],
  },
  {
    label: "Marketing",
    adminOnly: true,
    items: [
      { href: "/admin/subscribers", label: "Subscribers", hint: "Mailing list signups" },
      { href: "/admin/campaigns", label: "Campaigns", hint: "Emails sent to the list" },
      { href: "/admin/campaigns/new", label: "New campaign" },
    ],
  },
  {
    label: "Settings",
    adminOnly: true,
    items: [
      { href: "/admin/settings", label: "Tracking", hint: "Meta Pixel" },
      { href: "/admin/subusers", label: "Team", hint: "Admin and packer logins" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  const isAdminRole = session?.role === "ADMIN";

  const visible = (e: { adminOnly?: boolean }) => !e.adminOnly || isAdminRole;
  const nav: NavEntry[] = ALL_NAV.filter(visible).map((e) =>
    "items" in e ? { ...e, items: e.items.filter(visible) } : e
  );

  // One admin for every brand: the switcher picks which one the pages show
  // (lib/admin/brand-scope.ts). Shown even with one brand registered.
  const brandOptions: BrandOption[] = [
    { id: ALL_BRANDS_SCOPE, label: "All brands" },
    ...allBrands().map((b) => ({ id: b.id, label: b.name })),
  ];
  const brandScope = session ? await adminBrandScope() : ALL_BRANDS_SCOPE;

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="no-print relative border-b border-line bg-brand-deep text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href={isAdminRole ? "/admin" : "/admin/orders"}
              className="flex items-center gap-2"
            >
              {/* Neutral: the admin serves every brand. */}
              <span className="font-display text-lg font-semibold">Ops</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {session?.role === "PACKER" ? "Packer" : "Admin"}
              </span>
            </Link>
            {session && <AdminNav entries={nav} />}
          </div>
          {session && (
            <div className="flex items-center gap-4">
              {/* useSearchParams: a boundary keeps any static render whole. */}
              <Suspense fallback={null}>
                <BrandSwitcher options={brandOptions} current={brandScope} />
              </Suspense>
              <form action={adminLogoutAction}>
                <button type="submit" className="text-sm text-white/75 hover:text-white">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
