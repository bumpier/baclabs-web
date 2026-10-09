import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import { ActionForm } from "@/components/admin/ActionForm";
import { catchUpTrackingAction, closeCatchUpGroupAction } from "@/app/admin/shipping/actions";
import { CATCH_UP_AFTER_DAYS, catchUpCount, catchUpGroups, type ClosableCatchUpGroup } from "@/lib/shipping/catch-up";
import { trackingUnavailableReason } from "@/lib/shipping/tracking-sync";
import { TRACKING_STAGE_LABELS, type TrackingStage } from "@/lib/shipping/tracking";
import { statusLabel } from "@/lib/order-status";
import { formatSaleDate, formatSaleDateTime, saleTime } from "@/lib/saleTime";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof catchUpGroups>>["noLabel"][number];

function OrderList({ rows, detail }: { rows: Row[]; detail: (r: Row) => string | null }) {
  return (
    <ul className="mt-4 max-h-96 divide-y divide-line overflow-y-auto border-t border-line text-sm">
      {rows.map((r) => {
        const extra = detail(r);
        return (
          <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span className="min-w-0">
              <span className="font-mono">{r.id.slice(0, 8)}</span>
              {r.customerName ? ` · ${r.customerName}` : ""}
              <span className="text-ink-soft">
                {" "}
                · sold {formatSaleDate(saleTime(r))} · {statusLabel(r.status, { hasLabel: r.shipments.length > 0 })}
              </span>
              {extra && <span className="block text-xs text-ink-soft">{extra}</span>}
            </span>
            <Link href={`/admin/orders/${r.id}`} className="font-semibold text-brand hover:text-brand-deep">
              Open →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Group({
  group,
  title,
  explain,
  rows,
  detail,
}: {
  /** Absent for a group that may not be marked delivered. */
  group?: ClosableCatchUpGroup;
  title: string;
  explain: string;
  rows: Row[];
  detail: (r: Row) => string | null;
}) {
  return (
    <section className="card mt-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-lg font-medium text-brand-deep">
            {title} <span className="text-ink-soft">({rows.length})</span>
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{explain}</p>
        </div>
        {group && rows.length > 0 && (
          <ActionForm
            action={closeCatchUpGroupAction}
            submitLabel={`Mark ${rows.length} delivered`}
            className="space-y-2"
            confirm={`Mark these ${rows.length} orders delivered? No emails are sent.`}
          >
            <input type="hidden" name="group" value={group} />
          </ActionForm>
        )}
      </div>
      {rows.length > 0 ? (
        <OrderList rows={rows} detail={detail} />
      ) : (
        <p className="mt-4 text-sm text-ink-soft">None.</p>
      )}
    </section>
  );
}

/**
 * The one-off clear-out of orders that went out long ago but still count as
 * waiting (lib/shipping/catch-up.ts). Admins only: /admin/shipping is closed
 * to packers by the middleware, and the actions check again.
 */
export default async function CatchUpPage() {
  await requireAdminRole("ADMIN");
  const [groups, old, unavailable] = await Promise.all([catchUpGroups(), catchUpCount(), trackingUnavailableReason()]);
  const shown = groups.noLabel.length + groups.labelFailed.length + groups.notScanned.length;
  const pendingLabels = old - shown;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Postage</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Catch up old orders</h1>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">
        Orders sold more than {CATCH_UP_AFTER_DAYS} days ago that still count as waiting to go out. Check tracking
        first: every one with a label moves to shipped or delivered from what the carrier says, and customers whose
        order is more than a week old are not emailed. What tracking cannot settle is listed below, in groups, each
        with its own button.
      </p>

      <section className="card mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">1. Check tracking</h2>
        {unavailable ? (
          <p className="mt-2 text-sm text-amber-700">Tracking is not running: {unavailable}.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">
              Asks SmartTrack about every open order&rsquo;s label, about a minute at a time. Press it again until it
              says every label has been checked.
            </p>
            <ActionForm action={catchUpTrackingAction} submitLabel="Check tracking / Continue" className="mt-4 space-y-2" />
          </>
        )}
      </section>

      <Group
        group="noLabel"
        title="2. No label on record"
        explain="Sent before labels were bought here, or labelled somewhere else, so tracking knows nothing about them. Marked delivered, with no dates and no email."
        rows={groups.noLabel}
        detail={() => null}
      />
      <Group
        group="labelFailed"
        title="3. The automatic label failed"
        explain="The label could not be bought when the order was paid. If these went out with a label made somewhere else, mark them delivered; if not, open each one and buy its label."
        rows={groups.labelFailed}
        detail={(r) => r.labelError}
      />
      <Group
        title="4. Labelled, but never scanned"
        explain="A label was bought, but the carrier has never scanned the parcel, so it may still be on the shelf. These are not marked delivered: tracking moves each one on when the carrier scans it. If one went out on a different label, open it and mark it shipped."
        rows={groups.notScanned}
        detail={(r) => {
          const s = r.shipments[0];
          if (!s) return null;
          if (!s.trackingCheckedAt) return "Tracking not checked yet";
          const stage = s.trackingStage ? TRACKING_STAGE_LABELS[s.trackingStage as TrackingStage] : "No tracking yet";
          return `${stage}${s.trackingEvent ? ` — ${s.trackingEvent}` : ""} · checked ${formatSaleDateTime(s.trackingCheckedAt)}`;
        }}
      />

      <p className="mt-6 text-sm text-ink-soft">
        {groups.recent} order{groups.recent === 1 ? " was" : "s were"} sold in the last {CATCH_UP_AFTER_DAYS} days and
        {groups.recent === 1 ? " is" : " are"} left alone: tracking moves {groups.recent === 1 ? "it" : "them"} on.
        {pendingLabels > 0 &&
          ` ${pendingLabels} older order${pendingLabels === 1 ? " has a label" : "s have labels"} still being bought — open them from the orders page.`}
      </p>
    </div>
  );
}
