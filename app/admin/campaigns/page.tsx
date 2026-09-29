import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { describeAudience, parseAudience } from "@/lib/campaigns";
import { formatSaleDate } from "@/lib/saleTime";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral text-ink-soft",
  sending: "bg-amber-50 text-amber-700",
  sent: "bg-brand-tint text-brand-deep",
};

export default async function AdminCampaignsPage() {
  await requireAdminRole("ADMIN");
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Mailing list</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-medium tracking-tight text-brand-deep">Campaigns</h1>
        <Link href="/admin/campaigns/new" className="btn-primary">
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-sm text-ink-soft">
          No campaigns yet. Write one to email your subscribers and past customers, with an optional discount
          code.
        </p>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Subject</th>
                <th className="px-5 py-3 font-semibold">Audience</th>
                <th className="px-5 py-3 font-semibold">Offer</th>
                <th className="px-5 py-3 font-semibold">Sent</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-brand-tint/40">
                  <td className="px-5 py-3 font-medium">
                    {c.subject}
                    <span className="block text-xs font-normal text-ink-soft">
                      {c.sentAt ? `Sent ${formatSaleDate(c.sentAt)}` : `Created ${formatSaleDate(c.createdAt)}`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{describeAudience(parseAudience(c.audience))}</td>
                  <td className="px-5 py-3 font-mono text-xs">{c.promoCode ?? "—"}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {c.status === "draft" ? "—" : `${c.sentCount} / ${c.recipientCount}`}
                    {c.failedCount > 0 && <span className="block text-xs text-red-600">{c.failedCount} failed</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/campaigns/${c.id}`} className="text-sm font-semibold text-brand hover:text-brand-deep">
                      {c.status === "draft" ? "Edit →" : "View →"}
                    </Link>
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
