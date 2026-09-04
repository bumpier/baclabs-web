// USD → crypto conversion for the self-hosted gateway.
//
// The gateway charges the EXACT crypto amount we send it (it does NOT convert
// from fiat), so checkout must turn the order's USD subtotal into a coin amount.
// USDT is treated 1:1 with USD; BTC/ETH/XMR use a live spot rate (CoinGecko),
// cached briefly. The rate is pinned at checkout time and the gateway's payment
// window (~30 min) absorbs short-term volatility.

export type CryptoMethod = "btc" | "eth" | "usdt" | "xmr";

const COINGECKO_IDS: Record<CryptoMethod, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  usdt: "tether",
  xmr: "monero",
};

// Transfer precision per coin (decimal places). Trailing zeros are trimmed.
const DECIMALS: Record<CryptoMethod, number> = { btc: 8, eth: 8, xmr: 8, usdt: 2 };

interface CacheEntry {
  price: number;
  ts: number;
}
const priceCache = new Map<CryptoMethod, CacheEntry>();
const TTL_MS = 60_000;

/** Format a positive number to at most `dp` decimals, trimming trailing zeros. */
export function formatCryptoAmount(value: number, dp: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("invalid crypto amount");
  }
  let s = value.toFixed(dp);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

/** USD price of one unit of the coin. USDT is 1. Cached for 60s; throws on failure. */
export async function fetchUsdPrice(method: CryptoMethod): Promise<number> {
  if (method === "usdt") return 1;

  const cached = priceCache.get(method);
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) return cached.price;

  const id = COINGECKO_IDS[method];
  const base =
    process.env.CRYPTO_PRICE_API_URL ||
    "https://api.coingecko.com/api/v3/simple/price";
  const res = await fetch(`${base}?ids=${id}&vs_currencies=usd`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`crypto price lookup failed (${res.status})`);

  const data = (await res.json()) as Record<string, { usd?: number }>;
  const price = data?.[id]?.usd;
  if (typeof price !== "number" || !(price > 0)) {
    throw new Error("crypto price lookup returned no usable rate");
  }
  priceCache.set(method, { price, ts: now });
  return price;
}

/**
 * Convert a USD amount to the crypto-amount string the gateway expects.
 * USDT is 1:1. `priceUsd` may be injected (tests); otherwise it's fetched live.
 */
export async function usdToCryptoAmount(
  usd: number,
  method: CryptoMethod,
  priceUsd?: number
): Promise<string> {
  if (!(usd > 0)) throw new Error("invalid USD amount");
  if (method === "usdt") return formatCryptoAmount(usd, DECIMALS.usdt);
  const price = priceUsd ?? (await fetchUsdPrice(method));
  return formatCryptoAmount(usd / price, DECIMALS[method]);
}
