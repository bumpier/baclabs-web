"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PRODUCT, bundleById, formatMinor, totalMinor, type BundleId } from "@/config/funnel";

type Coin = "btc" | "eth" | "usdt" | "xmr";

const COIN_LABELS: Record<Coin, { label: string; hint: string }> = {
  btc: { label: "Bitcoin", hint: "BTC" },
  eth: { label: "Ethereum", hint: "ETH" },
  usdt: { label: "Tether", hint: "USDT" },
  xmr: { label: "Monero", hint: "XMR" },
};

/**
 * Crypto checkout. Collects a delivery address, then hands off to the gateway.
 *
 * The amount shown here is the GBP order total. The gateway settles in USD and
 * converts to the coin at payment time, so the exact coin amount is only known
 * on the next screen — this page does not pretend otherwise.
 */
export function CheckoutForm({
  coins,
  bundleId,
  quantity,
}: {
  coins: string[];
  bundleId: string;
  quantity: number;
}) {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";

  const bundle = bundleById(bundleId)!;
  const total = totalMinor(bundle, quantity);
  const totalVials = bundle.vials * quantity;

  const [coin, setCoin] = useState<Coin>((coins[0] as Coin) ?? "btc");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: bundle.id as BundleId,
          quantity,
          method: coin,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          addressLine1: form.get("addressLine1"),
          addressLine2: form.get("addressLine2") ?? "",
          city: form.get("city"),
          postalCode: form.get("postalCode"),
          country: form.get("country"),
        }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <h1 className="text-2xl">Pay with cryptocurrency</h1>
      <p className="measure mt-2 text-base text-ink-soft">
        Prefer a card?{" "}
        <Link href="/#buy" className="link">
          Go back and check out with Stripe
        </Link>{" "}
        — it is faster, and the address is collected for you.
      </p>

      {cancelled ? (
        <p role="status" className="alert-note mt-6">
          That payment was cancelled. Nothing has been charged.
        </p>
      ) : null}

      {/* Order summary — the figures come from config, not from the URL. */}
      <dl className="panel mt-8 space-y-2 p-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">
            <span className="tabular">{totalVials}</span> × {PRODUCT.name.toLowerCase()},{" "}
            {PRODUCT.size}
          </dt>
          <dd className="tabular text-ink">{formatMinor(total)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular">{formatMinor(total)}</dd>
        </div>
        <p className="pt-1 text-xs text-ink-soft">
          Converted to your chosen coin at the live rate on the next screen.
        </p>
      </dl>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <fieldset className="border-0 p-0">
          <legend className="label">Pay with</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {coins.map((c) => {
              const meta = COIN_LABELS[c as Coin];
              if (!meta) return null;
              const selected = c === coin;
              return (
                <label
                  key={c}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-control border px-4 py-3 transition-colors duration-150 ${
                    selected ? "border-brand bg-brand-tint" : "border-line bg-surface"
                  }`}
                >
                  <span className="text-sm font-medium text-ink">{meta.label}</span>
                  <span className="text-xs text-ink-soft">{meta.hint}</span>
                  <input
                    type="radio"
                    name="coin"
                    value={c}
                    checked={selected}
                    onChange={() => setCoin(c as Coin)}
                    className="sr-only"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              className="field"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              className="field"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" required className="field" autoComplete="tel" />
        </div>

        <div>
          <label className="label" htmlFor="addressLine1">
            Address
          </label>
          <input
            id="addressLine1"
            name="addressLine1"
            required
            minLength={3}
            maxLength={200}
            className="field"
            autoComplete="address-line1"
          />
        </div>

        <div>
          <label className="label" htmlFor="addressLine2">
            Address line 2 <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id="addressLine2"
            name="addressLine2"
            maxLength={200}
            className="field"
            autoComplete="address-line2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="city">
              Town or city
            </label>
            <input
              id="city"
              name="city"
              required
              minLength={2}
              maxLength={100}
              className="field"
              autoComplete="address-level2"
            />
          </div>
          <div>
            <label className="label" htmlFor="postalCode">
              Postcode
            </label>
            <input
              id="postalCode"
              name="postalCode"
              required
              minLength={2}
              maxLength={20}
              className="field"
              autoComplete="postal-code"
            />
          </div>
          <div>
            <label className="label" htmlFor="country">
              Country
            </label>
            <select
              id="country"
              name="country"
              required
              defaultValue="GB"
              className="field"
              autoComplete="country"
            >
              <option value="GB">United Kingdom</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-cta" aria-busy={submitting}>
          {submitting ? "Redirecting…" : "Continue to payment"}
        </button>

        {error ? (
          <p role="alert" className="alert-error">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
