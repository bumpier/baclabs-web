"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Whether the basket drawer is open, for everything that opens it: the
 * header's basket button, every "Add to basket", a reorder link, and a
 * checkout that comes back unfinished. The drawer itself is
 * app/beauty/BasketDrawer.tsx, rendered once by the root layout.
 *
 * `added` is the SKU just put in, so the drawer can mark its line; `nonce`
 * changes with every add, so adding the same set twice marks it twice.
 */
interface DrawerApi {
  open: boolean;
  added: string | null;
  nonce: number;
  show: (added?: string) => void;
  hide: () => void;
}

const DrawerContext = createContext<DrawerApi | null>(null);

/**
 * Sits inside the kit's CartProvider. Its mount effect runs before the
 * provider's (React runs a child's effects first), so a reorder link's
 * ?buy= is still in the address here: the basket it fills opens at once.
 */
export function BasketDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("buy")) setOpen(true);
  }, []);

  const show = useCallback((sku?: string) => {
    setAdded(sku ?? null);
    setNonce((n) => n + 1);
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);

  const api = useMemo<DrawerApi>(() => ({ open, added, nonce, show, hide }), [open, added, nonce, show, hide]);
  return <DrawerContext.Provider value={api}>{children}</DrawerContext.Provider>;
}

export function useBasketDrawer(): DrawerApi {
  const api = useContext(DrawerContext);
  if (!api) throw new Error("useBasketDrawer() needs a <BasketDrawerProvider> above it (app/beauty/layout.tsx)");
  return api;
}
