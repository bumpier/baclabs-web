import { requireAdminRole } from "@/lib/adminAuth";
import { getMetaPixelStatus } from "@/lib/settings";
import MetaPixelForm from "./MetaPixelForm";

export const dynamic = "force-dynamic";

/** What the storefront actually sends, so Events Manager holds no surprises.
 *  Kept in step with the MAP table in lib/analytics.ts. */
const EVENTS: { name: string; when: string }[] = [
  { name: "PageView", when: "Every page, including client-side navigation" },
  { name: "ViewContent", when: "The product funnel is viewed" },
  { name: "SelectBundle", when: "A bundle size is chosen (custom event)" },
  { name: "InitiateCheckout", when: "Checkout is started" },
  { name: "Purchase", when: "An order is confirmed paid — once per order" },
];

export default async function AdminSettingsPage() {
  await requireAdminRole("ADMIN");

  const status = await getMetaPixelStatus();
  const live = status.pixelId !== null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Tracking</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Meta Pixel
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Add your pixel here and it goes live on the storefront without a rebuild or a redeploy.
      </p>

      {/* ── Status ─────────────────────────────────────────────── */}
      <div className="card mt-10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Current status
            </p>
            <p className="mt-2 font-display text-2xl font-medium text-brand-deep">
              {live ? `Tracking as ${status.pixelId}` : "Not tracking"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              live ? "bg-brand-tint text-brand-deep" : "bg-red-50 text-red-600"
            }`}
          >
            {live ? "Live" : "Off"}
          </span>
        </div>

        {status.source === "environment" && (
          <p className="alert-note mt-4">
            This ID comes from the <code>NEXT_PUBLIC_META_PIXEL_ID</code> build setting, not from
            this page. Saving a value below takes over from it — and that value can then be changed
            at any time without a redeploy.
          </p>
        )}
        {status.turnedOff && status.envPixelId && (
          <p className="alert-note mt-4">
            Tracking is switched off here, which overrides the{" "}
            <code>NEXT_PUBLIC_META_PIXEL_ID</code> build setting of {status.envPixelId}. Enter an ID
            below to start tracking again.
          </p>
        )}

        <MetaPixelForm pixelId={status.source === "database" ? status.pixelId! : ""} />
      </div>

      {/* ── Consent warning ────────────────────────────────────── */}
      <div className="card mt-8 border-warn-line bg-warn-tint p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">
          Before you switch this on
        </h2>
        <p className="mt-2 text-sm text-ink">
          The pixel sets Meta&rsquo;s own cookies on every visitor&rsquo;s device. This site has no
          cookie consent banner, and UK PECR requires consent <em>before</em> a non-essential cookie
          is set. The privacy policy updates itself to disclose the pixel as soon as you save one,
          but disclosure is not consent &mdash; a banner still needs building.
        </p>
      </div>

      {/* ── How to find the ID ─────────────────────────────────── */}
      <div className="card mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">
          Where to find your Pixel ID
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            Open{" "}
            <a
              className="link"
              href="https://business.facebook.com/events_manager2"
              target="_blank"
              rel="noreferrer noopener"
            >
              Meta Events Manager
            </a>
            .
          </li>
          <li>Go to Data sources and select your pixel.</li>
          <li>Copy the number shown under its name &mdash; that is the ID.</li>
          <li>Paste it above and save. No code to install; this site already carries the tag.</li>
        </ol>
        <p className="mt-4 text-sm text-ink-soft">
          To verify, open the storefront with Meta&rsquo;s Pixel Helper extension, or watch Test
          events in Events Manager. Ad blockers block the pixel, so check in a clean browser.
        </p>
      </div>

      {/* ── Events ─────────────────────────────────────────────── */}
      <div className="card mt-8 overflow-x-auto">
        <div className="p-6 pb-3">
          <h2 className="font-display text-lg font-medium text-brand-deep">What gets sent</h2>
          <p className="mt-1 text-sm text-ink-soft">
            These fire automatically once a pixel is set. Purchase carries the order value, currency
            and order ID.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
              <th className="px-6 py-3 font-semibold">Event</th>
              <th className="px-6 py-3 font-semibold">Fires when</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {EVENTS.map((e) => (
              <tr key={e.name}>
                <td className="px-6 py-3 font-mono font-medium text-brand-deep">{e.name}</td>
                <td className="px-6 py-3 text-ink-soft">{e.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
