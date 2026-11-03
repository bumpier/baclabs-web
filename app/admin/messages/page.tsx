import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { contactTopic } from "@/lib/contact";
import { formatSaleDateTime } from "@/lib/saleTime";
import { adminBrandScope, brandWhere, keepBrandParam } from "@/lib/admin/brand-scope";
import { brandChip } from "@/lib/admin/brand-chip";
import { BrandChip } from "@/components/admin/BrandChip";

export const dynamic = "force-dynamic";

// Every message from the contact form (lib/contact-inbox.ts). Each one is
// also emailed to the contact inbox and answered from there; this list is
// the record, and the fallback for any that the email did not reach.

const FILTERS = ["open", "closed", "all"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS: Record<Filter, string> = { open: "Open", closed: "Handled", all: "All" };

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; brand?: string }>;
}) {
  await requireAdminRole("ADMIN");
  const { filter: raw, brand: brandQuery } = await searchParams;
  const filter: Filter = FILTERS.includes(raw as Filter) ? (raw as Filter) : "open";
  // The admin's brand scope (lib/admin/brand-scope.ts).
  const inBrand = brandWhere(await adminBrandScope(brandQuery));
  const keep = keepBrandParam(brandQuery);

  const [rows, openCount] = await Promise.all([
    prisma.contactMessage.findMany({
      where: filter === "all" ? inBrand : { ...inBrand, status: filter },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.contactMessage.count({ where: { ...inBrand, status: "open" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Customers</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Messages</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        From the contact form. Each one is also emailed to the contact inbox; reply from there, then
        mark it handled here.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={keep(f === "open" ? "/admin/messages" : `/admin/messages?filter=${f}`)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:border-brand"
            }`}
          >
            {FILTER_LABELS[f]}
            {f === "open" ? <span className="tabular-nums"> ({openCount})</span> : null}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-sm text-ink-soft">
          {filter === "open" ? "Nothing waiting. New messages from /contact appear here." : "No messages."}
        </p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Brand</th>
                <th className="px-5 py-3 font-semibold">Received</th>
                <th className="px-5 py-3 font-semibold">Topic</th>
                <th className="px-5 py-3 font-semibold">From</th>
                <th className="px-5 py-3 font-semibold">Message</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-brand-tint/40">
                  <td className="px-5 py-3">
                    <BrandChip chip={brandChip(m.brand)} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{formatSaleDateTime(m.createdAt)}</td>
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/admin/messages/${m.id}`} className="text-brand hover:text-brand-deep">
                      {contactTopic(m.topic)?.label ?? m.topic}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="block">{m.name}</span>
                    <span className="block text-xs text-ink-soft">{m.email}</span>
                  </td>
                  <td className="max-w-sm px-5 py-3 text-ink-soft">
                    <span className="line-clamp-2">{m.message}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    {m.status === "open" ? (
                      <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-deep">Open</span>
                    ) : (
                      <span className="text-xs text-ink-soft">Handled</span>
                    )}
                    {!m.emailedAt && (
                      <span
                        title="The email to the contact inbox did not go. Reply from the message page."
                        className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                      >
                        Not emailed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
