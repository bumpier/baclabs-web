import Link from "next/link";
import type { Campaign } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { ActionForm } from "@/components/admin/ActionForm";
import { checkCompliance } from "@/lib/content-rules";
import {
  describeAudience,
  expiresText,
  parseAudience,
  renderCampaign,
  resolveAudience,
  type AudienceSpec,
} from "@/lib/campaigns";
import { formatSaleDateTime } from "@/lib/saleTime";
import { CampaignFields } from "@/app/admin/campaigns/CampaignFields";
import {
  createOfferAction,
  deleteDraftAction,
  removeOfferAction,
  retryFailedAction,
  saveCampaignAction,
  sendCampaignAction,
  sendTestAction,
} from "@/app/admin/campaigns/actions";

export const dynamic = "force-dynamic";

const PREVIEW_RECIPIENT = { email: "preview@example.com", firstName: "Alex" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminRole("ADMIN");
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  const audience = parseAudience(campaign.audience);
  const isDraft = campaign.status === "draft";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Progress without reloading by hand while a send is running. */}
      {campaign.status === "sending" ? <meta httpEquiv="refresh" content="5" /> : null}
      <Link href="/admin/campaigns" className="text-sm text-ink-soft hover:text-ink">
        ← Campaigns
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{isDraft ? "Draft" : campaign.status === "sending" ? "Sending…" : "Sent"}</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-brand-deep">{campaign.subject}</h1>
        </div>
        {isDraft && (
          <form action={deleteDraftAction}>
            <input type="hidden" name="id" value={campaign.id} />
            <button type="submit" className="text-sm font-semibold text-red-600 hover:text-red-700">
              Delete draft
            </button>
          </form>
        )}
      </div>

      {isDraft ? <DraftView campaign={campaign} audience={audience} audienceLabel={describeAudience(audience)} /> : <SentView campaign={campaign} audienceLabel={describeAudience(audience)} />}
    </div>
  );
}

async function DraftView({
  campaign: c,
  audience,
  audienceLabel,
}: {
  audience: AudienceSpec;
  campaign: Campaign;
  audienceLabel: string;
}) {
  const [recipients, warnings] = await Promise.all([
    resolveAudience(audience),
    Promise.resolve(checkCompliance([c.subject, c.preheader, c.bodyMarkdown])),
  ]);
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <div className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Write</h2>
          <ActionForm action={saveCampaignAction} submitLabel="Save" className="mt-4 space-y-4">
            <CampaignFields campaign={c} />
          </ActionForm>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Offer</h2>
          {c.promoCode ? (
            <>
              <p className="mt-2 text-sm text-ink-soft">
                <span className="font-mono text-base font-semibold text-ink">{c.promoCode}</span> &middot;{" "}
                {c.offerSummary}
                {c.offerExpiresAt ? ` · ends ${expiresText(c)}` : ""}. Live on card checkout now, in Stripe.
              </p>
              <ActionForm
                action={removeOfferAction}
                submitLabel="Remove offer"
                submitClassName="btn-secondary"
                className="mt-4 space-y-3"
                confirm="Switch this code off in Stripe and remove it from the campaign?"
              >
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                Creates a real promotion code in Stripe, applied once per order to the goods on card checkout.
                Crypto checkout has no discount codes.
              </p>
              <ActionForm action={createOfferAction} submitLabel="Create code in Stripe" className="mt-4 space-y-3">
                <input type="hidden" name="id" value={c.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="kind" className="label">
                      Discount
                    </label>
                    <select id="kind" name="kind" className="field">
                      <option value="percent">% off</option>
                      <option value="amount">£ off</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="value" className="label">
                      Amount
                    </label>
                    <input id="value" name="value" type="number" min={0.01} step="0.01" required className="field" />
                  </div>
                </div>
                <div>
                  <label htmlFor="code" className="label">
                    Code
                  </label>
                  <input
                    id="code"
                    name="code"
                    required
                    pattern="[A-Za-z0-9_\-]{3,30}"
                    defaultValue={`BACLAB${Math.floor(10 + Math.random() * 90)}`}
                    className="field font-mono uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="expires" className="label">
                      Ends <span className="font-normal text-ink-soft">(optional)</span>
                    </label>
                    <input id="expires" name="expires" type="date" className="field" />
                  </div>
                  <div>
                    <label htmlFor="maxRedemptions" className="label">
                      Max uses <span className="font-normal text-ink-soft">(optional)</span>
                    </label>
                    <input id="maxRedemptions" name="maxRedemptions" type="number" min={1} className="field" />
                  </div>
                </div>
              </ActionForm>
            </>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-display text-lg font-medium text-brand-deep">Preview</h2>
            <span className="text-xs text-ink-soft">As saved, for a recipient named Alex</span>
          </div>
          {/* srcDoc, not a URL: the site CSP allows no same-origin frames.
              Sandboxed with no permissions, so nothing in the email can run. */}
          <iframe
            title="Email preview"
            srcDoc={renderCampaign(c, PREVIEW_RECIPIENT)}
            sandbox=""
            className="h-[640px] w-full bg-white"
          />
        </div>

        {warnings.length > 0 && (
          <div className="alert-error">
            <p className="font-semibold">Check the wording before sending</p>
            <ul className="mt-1 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>
                  &ldquo;{w.match}&rdquo;: {w.why}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Send a test</h2>
          <ActionForm action={sendTestAction} submitLabel="Send test" submitClassName="btn-secondary" className="mt-4 space-y-3">
            <input type="hidden" name="id" value={c.id} />
            <input
              name="to"
              type="email"
              required
              placeholder="you@example.com"
              defaultValue={process.env.ORDER_NOTIFY_EMAIL ?? ""}
              aria-label="Send the test to"
              className="field"
            />
          </ActionForm>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Send</h2>
          <p className="mt-2 text-sm text-ink-soft">
            To {audienceLabel}:{" "}
            <span className="font-semibold text-ink tabular-nums">
              {recipients.length} {recipients.length === 1 ? "person" : "people"}
            </span>{" "}
            after removing unsubscribes and duplicates. Save first if you changed the audience.
          </p>
          {recipients.length > 0 ? (
            <ActionForm
              action={sendCampaignAction}
              submitLabel={`Send to ${recipients.length}`}
              className="mt-4 space-y-3"
              confirm={`Send "${c.subject}" to ${recipients.length} people now? This cannot be undone.`}
            >
              <input type="hidden" name="id" value={c.id} />
            </ActionForm>
          ) : null}
        </div>
      </div>
    </div>
  );
}

async function SentView({
  campaign: c,
  audienceLabel,
}: {
  campaign: Campaign;
  audienceLabel: string;
}) {
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId: c.id },
    orderBy: [{ status: "asc" }, { email: "asc" }],
    take: 200,
  });
  const queued = c.recipientCount - c.sentCount - c.failedCount;
  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Audience", value: c.recipientCount },
          { label: "Sent", value: c.sentCount },
          { label: "Still queued", value: Math.max(0, queued) },
          { label: "Failed", value: c.failedCount },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-medium text-brand-deep tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        To {audienceLabel}
        {c.promoCode ? ` · code ${c.promoCode} (${c.offerSummary})` : ""}
        {c.sentAt ? ` · finished ${formatSaleDateTime(c.sentAt)}` : ""}.
      </p>
      {c.failedCount > 0 && c.status === "sent" && (
        <ActionForm action={retryFailedAction} submitLabel={`Retry ${c.failedCount} failed`} submitClassName="btn-secondary" className="mt-4">
          <input type="hidden" name="id" value={c.id} />
        </ActionForm>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Recipient</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recipients.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2">{r.email}</td>
                  <td className="px-5 py-2">
                    <span className={r.status === "failed" ? "text-red-600" : r.status === "sent" ? "text-brand-deep" : "text-ink-soft"}>
                      {r.status}
                    </span>
                    {r.error && <span className="block text-xs text-ink-soft">{r.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.recipientCount > 200 && (
            <p className="border-t border-line px-5 py-3 text-xs text-ink-soft">Showing 200 of {c.recipientCount}.</p>
          )}
        </div>
        <div className="card overflow-hidden">
          <iframe title="Email as sent" srcDoc={renderCampaign(c, PREVIEW_RECIPIENT)} sandbox="" className="h-[640px] w-full bg-white" />
        </div>
      </div>
    </>
  );
}
