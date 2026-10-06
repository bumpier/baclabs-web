import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { getAdminSession } from "@/lib/adminAuth";
import { adminLogoutAction } from "@/app/admin/actions";
import { AdminNav, type NavEntry, type NavLink } from "@/components/admin/AdminNav";

// robots.txt already disallows /admin/, but a disallow stops crawling, not
// indexing: a URL linked from elsewhere can still appear as a bare result.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Gated<T> = T & { adminOnly?: boolean };

// Packers only ever see Orders, less its money pages; everything else is Admin-only.
const ALL_NAV: Gated<NavLink | { label: string; items: Gated<NavLink>[] }>[] = [
  { href: "/admin", label: "Overview", adminOnly: true },
  {
    label: "Orders",
    items: [
      { href: "/admin/orders", label: "All orders", hint: "Pick, pack and dispatch" },
      { href: "/admin/orders/scan", label: "Scan station", hint: "Check a parcel against its order" },
      { href: "/admin/takings", label: "Daily takings", hint: "Money taken, day by day", adminOnly: true },
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

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="no-print relative border-b border-line bg-brand-deep text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href={isAdminRole ? "/admin" : "/admin/orders"}
              className="flex items-center gap-2"
            >
              <span className="font-display text-lg font-semibold">{brand.name}</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {session?.role === "PACKER" ? "Packer" : "Admin"}
              </span>
            </Link>
            {session && <AdminNav entries={nav} />}
          </div>
          {session && (
            <form action={adminLogoutAction}>
              <button type="submit" className="text-sm text-white/75 hover:text-white">
                Sign out
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
