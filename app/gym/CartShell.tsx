"use client";

import type { ReactNode } from "react";
import { ShopProvider } from "@/brands/gym/components/ShopProvider";
import { CartDrawer } from "@/brands/gym/components/CartDrawer";

/**
 * The buying shell around every page: the shop's shared state (the drawer,
 * the delivery choice and the one checkout) and the slide-out cart itself.
 * The pages inside stay server components; they reach the shell through the
 * header's cart button, the cards' quick-add buttons and the phone's bar.
 *
 * Client code, under the root layout's CartProvider, and the file where npm
 * run test:bundle starts following the brand's buy flow: everything it
 * reaches reads the storefront view from the cart, never a profile or config/.
 */
export function CartShell({ children }: { children: ReactNode }) {
  return (
    <ShopProvider>
      {children}
      <CartDrawer />
    </ShopProvider>
  );
}
