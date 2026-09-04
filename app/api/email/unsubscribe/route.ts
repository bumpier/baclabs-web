import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unsubscribeSig } from "@/lib/customer-email";
import { brand } from "@/config/brand";

export const dynamic = "force-dynamic";

// One-click unsubscribe from marketing (nudge) emails. The link carries an
// HMAC of the email address, so no per-recipient token storage is needed.

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
     <body style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#1b2b24">
       <h2>${brand.name}</h2><p>${body}</p>
     </body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").toLowerCase();
  const sig = url.searchParams.get("sig") ?? "";

  if (!email || !sig) return page("Invalid link", "This unsubscribe link is invalid.", 400);

  const expected = Buffer.from(unsubscribeSig(email), "hex");
  const given = Buffer.from(sig, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return page("Invalid link", "This unsubscribe link is invalid.", 400);
  }

  await prisma.emailOptOut.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  return page(
    "Unsubscribed",
    "You've been unsubscribed from repurchase reminders. You'll still receive order receipts and shipping updates."
  );
}
