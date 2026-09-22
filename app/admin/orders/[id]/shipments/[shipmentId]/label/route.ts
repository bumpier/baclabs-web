import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/adminAuth";
import { shipmentLabelPdf, ShippingError } from "@/lib/shipping/shipments";
import { SmartTrackError } from "@/lib/smarttrack/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The carrier label, served from our own copy. SmartTrack's label URLs are
 * plain http and public to anyone holding them; this keeps the customer's
 * address behind the admin login. Packers need it too, and middleware
 * already limits them to /admin/orders/*.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; shipmentId: string }> }
) {
  if (!(await getAdminSession())) return new NextResponse("Unauthorised", { status: 401 });
  const { id, shipmentId } = await params;

  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, select: { orderId: true } });
  if (!shipment || shipment.orderId !== id) return new NextResponse("Not found", { status: 404 });

  let pdf: Buffer | null;
  try {
    pdf = await shipmentLabelPdf(shipmentId);
  } catch (err) {
    const detail = err instanceof ShippingError ? err.message : err instanceof SmartTrackError ? err.detail : null;
    if (!detail) console.error("[internal] label fetch failed", shipmentId, err);
    return new NextResponse(detail ?? "Could not fetch the label", { status: 502 });
  }
  if (!pdf) return new NextResponse("No label for this shipment", { status: 404 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="label-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
