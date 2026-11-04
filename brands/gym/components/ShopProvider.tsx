"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { deliveryQuote, type DeliveryOptionView } from "@/lib/commerce/view";

/**
 * What every page's buying parts share: whether the cart drawer is open, the
 * delivery chosen in it, and ONE checkout. The header's cart button, the
 * product cards' quick-add buttons, the phone's sticky bar and the drawer all
 * act on it, so the drawer's button pays for exactly what the drawer shows.
 *
 * One useBrandCheckout for the site, not one per button: the hook also reads
 * a `?payment=` return from an unfinished payment and says why, and two
 * copies would race for it. Its error is shown once, in the drawer, which
 * opens to show it. The payment page's cancel address is `/#buy`, the drawer's
 * id, so a customer who backs out of paying lands with their cart open.
 *
 * Under the brand's CartProvider (the root layout); everything it reads
 * comes from the storefront view the layout gave the cart.
 */
interface ShopApi {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Put a SKU in the cart, open the drawer, and say what went in. */
  addAndShow: (sku: string, said: string, qty?: number) => void;
  /** The last thing added, for the drawer's polite status line. */
  said: string;
  /** The delivery the checkout will be sent: the buyer's pick while it is still offered, else the first. */
  delivery: { option: DeliveryOptionView; priceMinor: number } | null;
  /** Every option this cart's value is offered, at the price the checkout charges. */
  deliveryOptions: { option: DeliveryOptionView; priceMinor: number }[];
  setDeliveryId: (id: string) => void;
  pay: (method: string) => void;
  pending: boolean;
  error: string | null;
}

const ShopContext = createContext<ShopApi | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const cart = useCart();
  const { storefront, priced, hydrated } = cart;
  const { checkout, pending, error } = useBrandCheckout();
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const [deliveryId, setDeliveryId] = useState<string | null>(null);

  const deliveryOptions = useMemo(() => deliveryQuote(storefront, priced.goodsMinor), [storefront, priced.goodsMinor]);
  const delivery = deliveryOptions.find((d) => d.option.id === deliveryId) ?? deliveryOptions[0] ?? null;

  const pay = useCallback(
    (method: string) => {
      void checkout({ deliveryOption: delivery?.option.id, method });
    },
    [checkout, delivery]
  );

  // Back from the payment page (its cancel address is /#buy), or a reorder
  // link: open the cart once the stored cart has been read.
  useEffect(() => {
    if (hydrated && window.location.hash === "#buy") setOpen(true);
  }, [hydrated]);

  // A refusal is shown in the drawer: open it so it is seen.
  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  const add = cart.add;
  const addAndShow = useCallback(
    (sku: string, words: string, qty = 1) => {
      add(sku, qty);
      setSaid(words);
      setOpen(true);
    },
    [add]
  );
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => {
    setOpen(false);
    setSaid("");
  }, []);

  const api = useMemo<ShopApi>(
    () => ({ open, openCart, closeCart, addAndShow, said, delivery, deliveryOptions, setDeliveryId, pay, pending, error }),
    [open, openCart, closeCart, addAndShow, said, delivery, deliveryOptions, pay, pending, error]
  );
  return <ShopContext.Provider value={api}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopApi {
  const shop = useContext(ShopContext);
  if (!shop) throw new Error("useShop() needs a <ShopProvider> above it (app/gym/CartShell.tsx)");
  return shop;
}
