import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { belongsToHost } from "@/brands/registry";

export const dynamic = "force-dynamic";

// Lightweight status endpoint polled by the pay page (/checkout/pay/[id]) so it
// can auto-advance to the confirmation page once the webhook marks the order
// paid. Order ids are unguessable UUIDs and only the status is returned.
//
// Only on the order's own brand's site: on any other brand's host the order
// does not exist (belongsToHost), so one brand's site can never be used to
// look up another's orders. BacLab's orders on BacLab's hosts answer as before.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, brand: true },
  });
  if (!order || !belongsToHost(order.brand, req.headers.get("host"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ status: order.status });
}
