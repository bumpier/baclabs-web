import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { formatSaleDate, formatSaleDateTime } from "@/lib/saleTime";
import {
  GIFT_EXPIRY_DAYS,
  GIFT_REASONS,
  GIFT_REASON_KEYS,
  MAX_GIFT_VIALS,
  giftReason,
  giftStatus,
  lastGiftDay,
} from "@/lib/vial-gifts";
import { ActionForm } from "@/components/admin/ActionForm";
import { plural, shortDay } from "@/components/admin/finance/parts";
import { cancelVialGiftAction, resendVialGiftEmailAction } from "./actions";
import { GiftForm } from "./GiftForm";

export const dynamic = "force-dynamic";

const PILL = "rounded-full px-2 py-0.5 text-xs font-semibold";

export default async function AdminFreeVialsPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  await requireAdminRole("ADMIN");
  const { email = "" } = await searchParams;
  const now = new Date();
  const gifts = await prisma.vialGift.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  const waiting = gifts.filter((g) => giftStatus(g, now) === "waiting");
  const waitingVials = waiting.reduce((n, g) => n + g.vials, 0);
  const waitingCustomers = new Set(waiting.map((g) => g.email)).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Orders</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Free vials</h1>
      <p className="mt-4 max-w-3xl text-sm text-ink-soft">
        Give a customer free vials, to say sorry or to say thank you. They go on the next order paid with that email
        address, at £0, and are packed with it; the customer is emailed as soon as you add them, in the wording of the
        reason you pick. Unused vials expire after {GIFT_EXPIRY_DAYS} days. They don&apos;t show on Stripe&apos;s
        payment page, only on the order once it is paid.
      </p>

      <section className="card mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Add free vials</h2>
        <GiftForm
          email={email.slice(0, 254)}
          maxVials={MAX_GIFT_VIALS}
          reasons={GIFT_REASON_KEYS.map((key) => ({ key, label: GIFT_REASONS[key].label }))}
        />
      </section>

      {gifts.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-sm text-ink-soft">No free vials given yet.</p>
      ) : (
        <>
          <p className="mt-8 text-sm text-ink-soft">
            {waiting.length > 0
              ? `${plural(waitingVials, "vial")} waiting, for ${plural(waitingCustomers, "customer")}.`
              : "Nothing waiting."}
          </p>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                  <th className="px-5 py-3 font-semibold">Added</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 text-right font-semibold">Vials</th>
                  <th className="px-5 py-3 font-semibold">Reason</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {gifts.map((g) => {
                  const status = giftStatus(g, now);
                  return (
                    <tr key={g.id} className="hover:bg-brand-tint/40">
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{formatSaleDateTime(g.createdAt)}</td>
                      <td className="px-5 py-3">{g.email}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{g.vials}</td>
                      <td className="px-5 py-3">
                        {GIFT_REASONS[giftReason(g.reason)].label}
                        {g.note ? <span className="block text-xs text-ink-soft">{g.note}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {status === "waiting" && (
                          <>
                            <span className={`${PILL} bg-brand-tint text-brand-deep`}>Waiting</span>
                            <span className="ml-2 text-xs text-ink-soft">until {shortDay(lastGiftDay(g.expiresAt))}</span>
                            {!g.emailedAt && (
                              <span
                                title="Resend did not take the email. Send it again, or tell the customer yourself."
                                className={`${PILL} ml-2 bg-amber-50 text-amber-700`}
                              >
                                Not emailed
                              </span>
                            )}
                          </>
                        )}
                        {status === "used" && g.orderId && (
                          <>
                            <span className={`${PILL} bg-emerald-50 text-emerald-700`}>Used</span>
                            <Link href={`/admin/orders/${g.orderId}`} className="link ml-2 text-xs">
                              Order {g.orderId.slice(0, 8)}
                            </Link>
                            {g.claimedAt && (
                              <span className="ml-1 text-xs text-ink-soft">on {formatSaleDate(g.claimedAt)}</span>
                            )}
                          </>
                        )}
                        {status === "cancelled" && <span className={`${PILL} bg-neutral-100 text-ink-soft`}>Cancelled</span>}
                        {status === "expired" && (
                          <span className={`${PILL} bg-neutral-100 text-ink-soft`}>
                            Expired {shortDay(lastGiftDay(g.expiresAt))}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {status === "waiting" && (
                          <div className="flex items-start justify-end gap-4">
                            {!g.emailedAt && (
                              <ActionForm
                                action={resendVialGiftEmailAction}
                                submitLabel="Send email again"
                                className="flex flex-col items-end gap-1"
                                submitClassName="whitespace-nowrap text-xs font-semibold text-brand-deep hover:underline"
                              >
                                <input type="hidden" name="id" value={g.id} />
                              </ActionForm>
                            )}
                            <ActionForm
                              action={cancelVialGiftAction}
                              submitLabel="Cancel"
                              className="flex flex-col items-end gap-1"
                              submitClassName="text-xs font-semibold text-red-600 hover:text-red-700"
                              confirm={`Cancel the ${plural(g.vials, "free vial")} for ${g.email}? They won't be added to their next order. The customer isn't told.`}
                            >
                              <input type="hidden" name="id" value={g.id} />
                            </ActionForm>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
