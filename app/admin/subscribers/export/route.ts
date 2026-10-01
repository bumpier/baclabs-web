import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { SUBSCRIBER_FILTERS, subscriberRows, type SubscriberFilter } from "@/lib/mailing-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quote a CSV cell, and defuse spreadsheet formulas (=, +, -, @ at the start). */
function cell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const url = new URL(req.url);
  const raw = url.searchParams.get("filter") ?? "all";
  const filter: SubscriberFilter = SUBSCRIBER_FILTERS.includes(raw as SubscriberFilter)
    ? (raw as SubscriberFilter)
    : "all";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);

  const rows = await subscriberRows({ filter, q });
  const header = ["email", "status", "source", "signed_up", "orders", "welcome_order_id", "welcome_claimed_at", "reminder_1_at", "reminder_2_at", "bonus_until", "unsubscribed_at", "consent_text"];
  const lines = rows.map((s) =>
    [
      s.email,
      s.status,
      s.source,
      s.createdAt.toISOString(),
      String(s.orderCount),
      s.welcomeOrderId ?? "",
      s.welcomeClaimedAt?.toISOString() ?? "",
      s.welcomeReminder1At?.toISOString() ?? "",
      s.welcomeReminder2At?.toISOString() ?? "",
      s.welcomeBonusUntil?.toISOString() ?? "",
      s.unsubscribedAt?.toISOString() ?? "",
      s.consentText,
    ]
      .map(cell)
      .join(",")
  );
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse([header.join(","), ...lines].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${filter}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
