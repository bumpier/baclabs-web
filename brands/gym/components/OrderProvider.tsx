"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { deliveryQuote, type DeliveryOptionView } from "@/lib/commerce/view";

/**
 * What the home page's buying parts share: the pack chosen on the ladder,
 * the delivery chosen in the basket, and ONE checkout. The ladder, the Lab
 * Kit offer, the basket and the phone's sticky buy bar all act on the same
 * choice, so the bar's button pays for exactly what the basket shows.
 *
 * One useBrandCheckout for the page, not one per button: the hook also reads
 * a `?payment=` return from an unfinished payment and says why, and two
 * copies would race for it. Its error is shown once, in the basket (#buy),
 * and a refusal from the sticky bar scrolls there so it is seen.
 *
 * Under the brand's CartProvider (the root layout); everything it reads
 * comes from the storefront view the layout gave the basket.
 */
interface OrderApi {
  /** The pack chosen on the ladder, or null while none is on sale. */
  sku: string | null;
  setSku: (sku: string) => void;
  /** The delivery the checkout will be sent: the buyer's pick while it is still offered, else the first. */
  delivery: { option: DeliveryOptionView; priceMinor: number } | null;
  /** Every option this basket's value is offered, at the price the checkout charges. */
  deliveryOptions: { option: DeliveryOptionView; priceMinor: number }[];
  setDeliveryId: (id: string) => void;
  pay: (method: string) => void;
  pending: boolean;
  error: string | null;
}

const OrderContext = createContext<OrderApi | null>(null);

export function OrderProvider({ defaultSku, children }: { defaultSku: string | null; children: ReactNode }) {
  const { storefront, priced } = useCart();
  const { checkout, pending, error } = useBrandCheckout();
  const [sku, setSku] = useState<string | null>(defaultSku);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);

  const deliveryOptions = useMemo(() => deliveryQuote(storefront, priced.goodsMinor), [storefront, priced.goodsMinor]);
  const delivery = deliveryOptions.find((d) => d.option.id === deliveryId) ?? deliveryOptions[0] ?? null;

  const pay = useCallback(
    (method: string) => {
      void checkout({ deliveryOption: delivery?.option.id, method });
    },
    [checkout, delivery]
  );

  // A refusal can come from the sticky bar, far from the basket: bring the
  // basket, and the alert in it, into view.
  useEffect(() => {
    if (error) document.getElementById("buy")?.scrollIntoView({ block: "start" });
  }, [error]);

  const api = useMemo<OrderApi>(
    () => ({ sku, setSku, delivery, deliveryOptions, setDeliveryId, pay, pending, error }),
    [sku, delivery, deliveryOptions, pay, pending, error]
  );
  return <OrderContext.Provider value={api}>{children}</OrderContext.Provider>;
}

export function useOrder(): OrderApi {
  const order = useContext(OrderContext);
  if (!order) throw new Error("useOrder() needs an <OrderProvider> above it (app/gym/page.tsx)");
  return order;
}
