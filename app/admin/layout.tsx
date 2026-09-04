import Link from "next/link";
import { brand } from "@/config/brand";
import { getAdminSession } from "@/lib/adminAuth";
import { adminLogoutAction } from "@/app/admin/actions";

const ALL_NAV = [
  { href: "/admin", label: "Overview", adminOnly: true },
  { href: "/admin/orders", label: "Orders", adminOnly: false },
  { href: "/admin/products", label: "Products", adminOnly: true },
  { href: "/admin/affiliates", label: "Affiliates", adminOnly: true },
  { href: "/admin/subusers", label: "Team", adminOnly: true },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  const isAdminRole = session?.role === "ADMIN";

  const nav = ALL_NAV.filter((item) => !item.adminOnly || isAdminRole);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="no-print border-b border-line bg-brand-deep text-white">
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
            {session && (
              <nav className="flex items-center gap-4 text-sm">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-white/75 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
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
