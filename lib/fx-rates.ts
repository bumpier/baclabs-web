import { brand } from "@/config/brand";
import { FALLBACK_GBP_RATES, type FxRates } from "@/lib/fx";

// Server-only. In-process cache, same pattern as lib/crypto-rates.ts.
// The source refreshes ~daily; 3h bounds staleness at ~8 fetches/day/process.
// A page render and a later checkout may straddle a refresh — the checkout
// (server) figure is authoritative, drift is one rate tick at most.
let cache: { rates: FxRates; ts: number } | null = null;
const TTL_MS = 3 * 60 * 60 * 1000;

/**
 * GBP-based FX rates for all supported currencies. NEVER throws:
 * fresh fetch → stale cache (retried each call once TTL expires) → static fallback.
 */
export async function fetchFxRates(): Promise<FxRates> {
  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) return cache.rates;

  try {
    const base = process.env.FX_RATE_API_URL || "https://open.er-api.com/v6/latest/GBP";
    const res = await fetch(base, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`fx rate lookup failed (${res.status})`);
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data?.result !== "success" || !data.rates) {
      throw new Error("fx rate lookup returned no usable rates");
    }
    // Any missing currency fails the whole fetch so the rate set stays consistent.
    const rates = { GBP: 1 } as FxRates;
    for (const c of brand.currency.supported) {
      if (c === "GBP") continue;
      const r = data.rates[c];
      if (typeof r !== "number" || !(r > 0)) throw new Error(`fx rate lookup missing ${c}`);
      rates[c] = r;
    }
    cache = { rates, ts: now };
    return rates;
  } catch (err) {
    console.error("[internal] fx rate fetch failed", err);
    // Stale cache is served indefinitely (ts left untouched so we retry next call).
    return cache?.rates ?? FALLBACK_GBP_RATES;
  }
}
