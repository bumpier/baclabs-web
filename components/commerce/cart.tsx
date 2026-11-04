"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BUY_PARAM, parseBuyParam } from "@/lib/commerce/links";
import { priceBasket, type BasketLine, type PricedBasket, type StorefrontView } from "@/lib/commerce/view";

/**
 * A brand storefront's basket: lines of { sku, qty }, nothing else. No
 * prices are stored (they are read from the storefront view, and the checkout
 * prices again from the catalogue), and no currency is converted: every
 * brand sells in pounds.
 *
 * Kept in this browser's localStorage under the brand's own `storageKey`,
 * never a cookie, so the basket reaches the server only at checkout, which
 * is what the brand's privacy notice says. Each brand's domain has its own
 * storage anyway; the key keeps a development host's basket apart too.
 * Storage can be blocked (some private modes), so every read and write is
 * guarded and the basket then lasts for the page view.
 *
 * A link with ?buy=SKU:qty,... (the reorder button in a brand's emails,
 * lib/commerce/links.ts) replaces the basket with the one it names, and the
 * parameter is then taken off the address, so a reload does not apply it
 * twice. SKUs the brand does not sell are dropped, wherever they came from.
 */

export interface CartApi {
  /** One line per SKU, in the order they were added. */
  lines: readonly BasketLine[];
  /** False until the stored basket has been read; render counts after it to avoid a flash. */
  hydrated: boolean;
  /** Packs and add-ons, counted. */
  count: number;
  /** The basket priced from the view (display only), with the checkout's reason to refuse it. */
  priced: PricedBasket;
  storefront: StorefrontView;
  add: (sku: string, qty?: number) => void;
  /** Sets a line's count; 0 removes it. */
  set: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  replace: (lines: readonly BasketLine[]) => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

/**
 * Lines the brand sells, merged by SKU and clamped to what one order can
 * carry. Anything malformed is dropped: stored state and links are inputs
 * like any other.
 */
export function cleanLines(raw: unknown, view: StorefrontView): BasketLine[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set([...view.packs.map((p) => p.sku), ...view.addOns.map((a) => a.sku)]);
  const merged = new Map<string, number>();
  for (const item of raw) {
    const sku = typeof item?.sku === "string" ? item.sku.trim().toUpperCase() : "";
    const qty: unknown = item?.qty;
    if (!known.has(sku) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) continue;
    merged.set(sku, Math.min(view.limits.maxLineQty, (merged.get(sku) ?? 0) + qty));
  }
  return [...merged].slice(0, view.limits.maxLines).map(([sku, qty]) => ({ sku, qty }));
}

function readStored(key: string, view: StorefrontView): BasketLine[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? cleanLines(JSON.parse(raw), view) : [];
  } catch {
    return [];
  }
}

export function CartProvider({
  storageKey,
  storefront,
  children,
}: {
  /** The brand's own key, e.g. "luxury-basket-v1". Bump the suffix to drop every stored basket. */
  storageKey: string;
  storefront: StorefrontView;
  children: ReactNode;
}) {
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // The view is server data and does not change while the page is open; a
  // ref keeps it out of the effects' dependencies.
  const view = useRef(storefront);
  view.current = storefront;

  useEffect(() => {
    let next = readStored(storageKey, view.current);
    const url = new URL(window.location.href);
    if (url.searchParams.has(BUY_PARAM)) {
      const linked = cleanLines(parseBuyParam(url.searchParams.get(BUY_PARAM)), view.current);
      if (linked.length > 0) next = linked;
      url.searchParams.delete(BUY_PARAM);
      // The documented way to change the address under the App Router
      // without a navigation; Next keeps its own history state.
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setLines(next);
    setHydrated(true);

    // Another tab changed the basket: follow it.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setLines(readStored(storageKey, view.current));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      // Cannot persist: the basket lasts for this page view.
    }
  }, [lines, hydrated, storageKey]);

  const update = useCallback((fn: (prev: BasketLine[]) => unknown) => {
    setLines((prev) => cleanLines(fn(prev), view.current));
  }, []);
  // Stable, and a no-op on an empty basket, so ClearBasket cannot loop.
  const clear = useCallback(() => setLines((prev) => (prev.length ? [] : prev)), []);

  const api = useMemo<CartApi>(
    () => ({
      lines,
      hydrated,
      count: lines.reduce((n, l) => n + l.qty, 0),
      priced: priceBasket(storefront, lines),
      storefront,
      add: (sku, qty = 1) => update((prev) => [...prev, { sku, qty }]),
      set: (sku, qty) =>
        update((prev) => {
          const code = sku.trim().toUpperCase();
          const rest = prev.filter((l) => l.sku !== code);
          if (qty <= 0) return rest;
          const at = prev.findIndex((l) => l.sku === code);
          const line = { sku: code, qty };
          return at < 0 ? [...prev, line] : prev.map((l, i) => (i === at ? line : l));
        }),
      remove: (sku) => update((prev) => prev.filter((l) => l.sku !== sku.trim().toUpperCase())),
      replace: (next) => update(() => next),
      clear,
    }),
    [lines, hydrated, storefront, update, clear]
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart() needs a <CartProvider> above it (the brand's root layout)");
  return cart;
}

/**
 * Empties the basket once `when` is true: on the order confirmation page,
 * once the order is paid, so the next visit starts clean. Renders nothing.
 */
export function ClearBasket({ when }: { when: boolean }) {
  const { clear, hydrated } = useCart();
  const done = useRef(false);
  useEffect(() => {
    if (!when || !hydrated || done.current) return;
    done.current = true;
    clear();
  }, [when, hydrated, clear]);
  return null;
}
