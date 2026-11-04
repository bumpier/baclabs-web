import { handlePayPalReturn } from "@/lib/commerce/payments/paypal-settle";

// Prisma and PayPal: Node only. Per request, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where PayPal sends a brand's buyer back after approving: capture, then on
// to the order confirmation (lib/commerce/payments/paypal-settle.ts).
export function GET(req: Request) {
  return handlePayPalReturn(req);
}
