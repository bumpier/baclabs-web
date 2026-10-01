import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import {
  SUBSCRIBER_FILTERS,
  subscriberRows,
  subscriberStats,
  type SubscriberFilter,
} from "@/lib/mailing-list";
import { ActionForm } from "@/components/admin/ActionForm";
import { formatSaleDate } from "@/lib/saleTime";
import {
  addSubscriberAction,
  deleteSubscriberAction,
  unsubscribeSubscriberAction,
} from "@/app/admin/subscribers/actions";

export const dynamic = "force-dynamic";

const FILTER_LABELS: Record<SubscriberFilter, string> = {
  all: "All",
  subscribed: "Subscribed",
  unsubscribed: "Unsubscribed",
  redeemed: "Free vial used",
  not_ordered: "Not ordered yet",
};

const SOURCE_LABELS: Record<string, string> = {
  popup: "Popup",
  footer: "Footer",
  inline: "Buy block",
  admin: "Added by admin",
};

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdminRole("ADMIN");
  const { filter: rawFilter, q: rawQ } = await searchParams;
  const filter: SubscriberFilter = SUBSCRIBER_FILTERS.includes(rawFilter as SubscriberFilter)
    ? (rawFilter as SubscriberFilter)
    : "all";
  const q = (rawQ ?? "").trim().slice(0, 100);

  const [rows, stats] = await Promise.all([subscriberRows({ filter, q, take: 200 }), subscriberStats()]);
  const query = (f: SubscriberFilter) => {
    const p = new URLSearchParams();
    if (f !== "all") p.set("filter", f);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/admin/subscribers?${s}` : "/admin/subscribers";
  };
  const exportHref = `/admin/subscribers/export?${new URLSearchParams({ filter, ...(q ? { q } : {}) })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Mailing list</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-medium tracking-tight text-brand-deep">Subscribers</h1>
        <div className="flex gap-2">
          <a href={exportHref} className="btn-secondary">
            Export CSV
          </a>
          <Link href="/admin/campaigns/new" className="btn-primary">
            Write a campaign
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Subscribed", value: stats.subscribed },
          { label: "Signed up in the last 7 days", value: stats.lastWeek },
          { label: "Free vials claimed", value: stats.redeemed },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-medium text-brand-deep tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {SUBSCRIBER_FILTERS.map((f) => (
            <Link
              key={f}
              href={query(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:border-brand"
              }`}
            >
              {FILTER_LABELS[f]}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action="/admin/subscribers">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email"
            aria-label="Search by email"
            className="w-56 rounded-full border border-line bg-white px-4 py-1.5 text-sm"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-sm text-ink-soft">
          {filter === "all" && !q
            ? "Nobody has signed up yet. The form is in the footer, the popup and the buy blocks."
            : "No subscribers match."}
        </p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Signed up</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">Orders</th>
                <th className="px-5 py-3 font-semibold">Free vial</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-brand-tint/40">
                  <td className="px-5 py-3 font-medium">{s.email}</td>
                  <td className="px-5 py-3 text-ink-soft">{formatSaleDate(s.createdAt)}</td>
                  <td className="px-5 py-3 text-ink-soft">{SOURCE_LABELS[s.source] ?? s.source}</td>
                  <td className="px-5 py-3 tabular-nums">{s.orderCount}</td>
                  <td className="px-5 py-3">
                    {s.welcomeOrderId ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/orders/${s.welcomeOrderId}`} className="font-semibold text-brand hover:text-brand-deep">
                          Used →
                        </Link>
                        {s.duplicateAddress && (
                          <span
                            title="An earlier welcome vial went to the same address"
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                          >
                            Repeat address
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-soft">
                        Waiting
                        {s.welcomeReminder1At && (
                          <span className="block text-xs">
                            {s.welcomeReminder2At
                              ? `Reminded twice, last ${formatSaleDate(s.welcomeReminder2At)}`
                              : `Reminded ${formatSaleDate(s.welcomeReminder1At)}`}
                            {s.welcomeReminder2At && s.welcomeBonusUntil
                              ? `; bonus vials to ${formatSaleDate(s.welcomeBonusUntil)}`
                              : null}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        s.status === "subscribed" ? "bg-brand-tint text-brand-deep" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {s.status === "subscribed" && (
                        <form action={unsubscribeSubscriberAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="text-xs font-semibold text-ink-soft hover:text-ink">
                            Unsubscribe
                          </button>
                        </form>
                      )}
                      <form action={deleteSubscriberAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                          title="Erase this subscriber. The address stays opted out."
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 200 && (
            <p className="border-t border-line px-5 py-3 text-xs text-ink-soft">
              Showing the latest 200. Search, or export the CSV for everyone.
            </p>
          )}
        </div>
      )}

      <div className="card mt-8 max-w-xl p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Add a subscriber</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Only for someone who has asked to hear from you, for example by email. The record notes it was
          added by an admin.
        </p>
        <ActionForm action={addSubscriberAction} submitLabel="Add" className="mt-4 space-y-3">
          <label className="label" htmlFor="add-email">
            Email
          </label>
          <input id="add-email" name="email" type="email" required className="field" />
        </ActionForm>
      </div>
    </div>
  );
}
