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
  MAX_QUANTITY,
  MIN_QUANTITY,
  bundleById,
  totalMinor,
  type Bundle,
  type BundleId,
} from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";

/**
 * The selected tier and quantity, shared by the purchase block and the sticky
 * bar so the bar always shows what the customer has actually chosen.
 *
 * Deliberately not persisted: a remembered selection from a previous visit is
 * a small convenience that risks charging someone for a tier they do not
 * remember picking.
 */
interface FunnelState {
  bundle: Bundle;
  quantity: number;
  totalMinor: number;
  select: (id: BundleId) => void;
  setQuantity: (n: number) => void;
}

const Ctx = createContext<FunnelState | null>(null);

export function FunnelStateProvider({ children }: { children: ReactNode }) {
  const [bundleId, setBundleId] = useState<BundleId>(DEFAULT_BUNDLE_ID);
  const [quantity, setQuantityState] = useState(1);

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
  }, []);

  const value = useMemo<FunnelState>(
    () => ({
      bundle,
      quantity,
      totalMinor: totalMinor(bundle, quantity),
      select,
      setQuantity,
    }),
    [bundle, quantity, select, setQuantity]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFunnel(): FunnelState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFunnel must be used inside <FunnelStateProvider>");
  return ctx;
}
