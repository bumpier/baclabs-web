"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BUNDLES,
  DEFAULT_BUNDLE_ID,
  MAX_EXTRA_VIALS,
  MAX_QUANTITY,
  MIN_QUANTITY,
  SINGLE_BUNDLE,
  bundleById,
  priceOrder,
  type Bundle,
  type BundleId,
} from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { parsePackQuery } from "@/lib/pack-link";

/**
 * The selected tier and quantity, shared by the purchase block and the sticky
 * bar so the bar always shows what the customer has actually chosen.
 *
 * Deliberately not persisted: a remembered selection from a previous visit is
 * a small convenience that risks charging someone for a tier they do not
 * remember picking.
 */
/** A one-time pack, or a monthly plan. */
export type PurchaseMode = "plan" | "once";

interface FunnelState {
  bundle: Bundle;
  quantity: number;
  /**
   * Loose single vials on top of the packs, added from the upsell's top-up
   * (lib/upsell.ts). Any change to the packs drops them, since the reason
   * for adding them (reaching free delivery) went with the old selection.
   */
  extraVials: number;
  /** Vials in the order, loose ones included. */
  vials: number;
  /** Goods in pence: the packs plus the loose vials (priceOrder). */
  totalMinor: number;
  select: (id: BundleId) => void;
  setQuantity: (n: number) => void;
  setExtraVials: (n: number) => void;
  /**
   * Which half of the buy box's switch is showing. Shared so the mobile buy
   * bar never offers to charge the one-time pack while the customer is
   * looking at a plan.
   */
  mode: PurchaseMode;
  setMode: (m: PurchaseMode) => void;
}

const Ctx = createContext<FunnelState | null>(null);

/**
 * `initialBundleId` is which tier the page opens on. The home page omits it
 * and gets DEFAULT_BUNDLE_ID as before; a pack page under /products passes
 * its own tier, because a page whose whole subject is the 100-vial pack must
 * not open with the 5-vial pack selected — the `view_item` event below would
 * report the wrong tier, and so would the buy bar.
 */
export function FunnelStateProvider({
  children,
  initialBundleId = DEFAULT_BUNDLE_ID,
}: {
  children: ReactNode;
  initialBundleId?: BundleId;
}) {
  const [bundleId, setBundleId] = useState<BundleId>(initialBundleId);
  const [quantity, setQuantityState] = useState(1);
  const [extraVials, setExtraVialsState] = useState(0);
  // One-time opens selected: a preselected prepaid plan would put a much
  // larger charge in front of someone who came for one pack.
  const [mode, setModeState] = useState<PurchaseMode>("once");

  const bundle = bundleById(bundleId) ?? BUNDLES[0];

  // One view_item per page view, with the value of the default selection.
  useEffect(() => {
    trackEvent("view_item", {
      currency: "GBP",
      value: bundle.priceMinor / 100,
      bundleId: bundle.id,
      vials: bundle.vials,
    });
    // Intentionally once per mount, not per selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback((id: BundleId) => {
    setBundleId(id);
    setExtraVialsState(0);
    const b = bundleById(id);
    if (b) {
      trackEvent("select_bundle", {
        currency: "GBP",
        value: b.priceMinor / 100,
        bundleId: b.id,
        vials: b.vials,
      });
    }
  }, []);

  const setQuantity = useCallback((n: number) => {
    setQuantityState(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.round(n) || MIN_QUANTITY)));
    setExtraVialsState(0);
  }, []);

  const setExtraVials = useCallback((n: number) => {
    setExtraVialsState(Math.min(MAX_EXTRA_VIALS, Math.max(0, Math.round(n) || 0)));
  }, []);

  const setMode = useCallback((m: PurchaseMode) => {
    setModeState(m);
    setExtraVialsState(0);
  }, []);

  // No loose vials on the single tier: more singles is a bigger quantity.
  const extras = bundle.id === SINGLE_BUNDLE.id ? 0 : extraVials;
  const priced = useMemo(
    () => priceOrder(bundle, quantity, extras) ?? priceOrder(bundle, quantity)!,
    [bundle, quantity, extras]
  );

  const value = useMemo<FunnelState>(
    () => ({
      bundle,
      quantity,
      extraVials: priced.extraVials,
      vials: priced.vials,
      totalMinor: priced.goodsMinor,
      select,
      setQuantity,
      setExtraVials,
      mode,
      setMode,
    }),
    [bundle, quantity, priced, select, setQuantity, setExtraVials, mode, setMode]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFunnel(): FunnelState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFunnel must be used inside <FunnelStateProvider>");
  return ctx;
}

/**
 * Honour /?pack=ten&qty=1&extra=1#buy (the reorder email and the
 * checkout-recovery fallback, lib/pack-link.ts): open the one-time half on
 * that order. Read after mount from window.location, NOT useSearchParams, so
 * the home page stays static. Call it before usePlanQuery, so a link naming
 * a plan as well still opens on the plan.
 */
export function usePackQuery() {
  const { select, setQuantity, setExtraVials, setMode } = useFunnel();
  useEffect(() => {
    const wanted = parsePackQuery(window.location.search);
    if (!wanted) return;
    // In this order: choosing the pack and the quantity each drop loose
    // vials, so they go last.
    setMode("once");
    select(wanted.bundleId);
    setQuantity(wanted.quantity);
    setExtraVials(wanted.extraVials);
  }, [select, setQuantity, setExtraVials, setMode]);
}
