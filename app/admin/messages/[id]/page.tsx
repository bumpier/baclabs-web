import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { ActionForm } from "@/components/admin/ActionForm";
import { brand } from "@/config/brand";
import { contactTopic } from "@/lib/contact";
import { findOrderByRef } from "@/lib/contact-inbox";
import { statusLabel } from "@/lib/order-status";
import { formatSaleDateTime } from "@/lib/saleTime";
import { deleteMessageAction, setMessageStatusAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * The sender's latest orders. Order emails keep the case Stripe gave them,
 * so the match is on lower() (as previousOrderCount in lib/mailing-list.ts).
 */
async function recentOrdersFor(email: string) {
  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order" WHERE lower("customerEmail") = ${email}
    ORDER BY "createdAt" DESC LIMIT 5`;
  if (ids.length === 0) return [];
  return prisma.order.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });
}

export default async function AdminMessagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminRole("ADMIN");
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();

  const msg = await prisma.contactMessage.findUnique({ where: { id } });
  if (!msg) notFound();

  const [orderId, orders, earlier] = await Promise.all([
    msg.orderRef ? findOrderByRef(msg.orderRef) : Promise.resolve(null),
    recentOrdersFor(msg.email),
    prisma.contactMessage.findMany({
      where: { email: msg.email, id: { not: msg.id } },
      orderBy: { createdAt: "desc" },
      select: { id: true, topic: true, createdAt: true },
      take: 5,
    }),
  ]);

  const topic = contactTopic(msg.topic)?.label ?? msg.topic;
  const replyHref = `mailto:${msg.email}?subject=${encodeURIComponent(`Re: your message to ${brand.name}`)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/admin/messages" className="text-sm text-ink-soft hover:text-ink">
        ← Messages
      </Link>
      <p className="eyebrow mt-6">{msg.status === "open" ? "Open" : "Handled"}</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">{topic}</h1>

      <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-ink-soft">From</dt>
        <dd>
          {msg.name} &lt;{msg.email}&gt;
        </dd>
        <dt className="text-ink-soft">Received</dt>
        <dd>{formatSaleDateTime(msg.createdAt)}</dd>
        <dt className="text-ink-soft">Order</dt>
        <dd>
          {!msg.orderRef ? (
            <span className="text-ink-soft">Not given</span>
          ) : orderId ? (
            <Link href={`/admin/orders/${orderId}`} className="font-semibold text-brand hover:text-brand-deep">
              {msg.orderRef} →
            </Link>
          ) : (
            <>
              {msg.orderRef} <span className="text-ink-soft">(no order matches this)</span>
            </>
          )}
        </dd>
        <dt className="text-ink-soft">Emailed</dt>
        <dd>
          {msg.emailedAt ? (
            formatSaleDateTime(msg.emailedAt)
          ) : (
            <span className="font-semibold text-amber-700">No. It is only here, so reply with the button below.</span>
          )}
        </dd>
        {msg.closedAt ? (
          <>
            <dt className="text-ink-soft">Handled</dt>
            <dd>{formatSaleDateTime(msg.closedAt)}</dd>
          </>
        ) : null}
      </dl>

      <div className="card mt-6 whitespace-pre-wrap break-words p-6 text-sm leading-relaxed">{msg.message}</div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a href={replyHref} className="btn-primary">
          Reply by email
        </a>
        <form action={setMessageStatusAction}>
          <input type="hidden" name="id" value={msg.id} />
          <input type="hidden" name="status" value={msg.status === "open" ? "closed" : "open"} />
          <button type="submit" className="btn-secondary">
            {msg.status === "open" ? "Mark as handled" : "Reopen"}
          </button>
        </form>
      </div>

      {orders.length > 0 || earlier.length > 0 ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {orders.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Orders from this email</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand hover:text-brand-deep">
                      {o.id.slice(0, 8).toUpperCase()}
                    </Link>{" "}
                    <span className="text-ink-soft">
                      {formatSaleDateTime(o.createdAt)} · {statusLabel(o.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {earlier.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Other messages from them</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {earlier.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/messages/${m.id}`} className="font-medium text-brand hover:text-brand-deep">
                      {contactTopic(m.topic)?.label ?? m.topic}
                    </Link>{" "}
                    <span className="text-ink-soft">{formatSaleDateTime(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <div className="mt-12 border-t border-line pt-6">
        <ActionForm
          action={deleteMessageAction}
          submitLabel="Delete message"
          submitClassName="text-sm font-semibold text-red-600 hover:text-red-700"
          confirm="Delete this message for good? Do this for spam or an erasure request."
        >
          <input type="hidden" name="id" value={msg.id} />
        </ActionForm>
      </div>
    </div>
  );
}
