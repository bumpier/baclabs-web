import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unsubscribeSig } from "@/lib/customer-email";
import { brand } from "@/config/brand";

export const dynamic = "force-dynamic";

// Unsubscribe from marketing emails (nudges, review requests, campaigns). The link carries an
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

/** The lower-cased email, if the signature is ours; otherwise null. */
function verified(url: URL): string | null {
  const email = (url.searchParams.get("email") ?? "").toLowerCase();
  const sig = url.searchParams.get("sig") ?? "";
  if (!email || !sig) return null;
  const expected = Buffer.from(unsubscribeSig(email), "hex");
  const given = Buffer.from(sig, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return email;
}

/**
 * Opt out of every marketing email: nudges, review requests and campaigns
 * all check EmailOptOut. A mailing-list subscriber is marked unsubscribed as
 * well, so the admin list shows it.
 */
async function optOut(email: string): Promise<void> {
  await prisma.emailOptOut.upsert({ where: { email }, update: {}, create: { email } });
  await prisma.subscriber.updateMany({
    where: { email, status: "subscribed" },
    data: { status: "unsubscribed", unsubscribedAt: new Date() },
  });
}

export async function GET(req: Request) {
  const email = verified(new URL(req.url));
  if (!email) return page("Invalid link", "This unsubscribe link is invalid.", 400);

  await optOut(email);

  return page(
    "Unsubscribed",
    "You've been unsubscribed from marketing emails from us, including offers and reminders. You'll still receive order receipts and shipping updates."
  );
}

/**
 * One-click unsubscribe (RFC 8058). Mail clients POST
 * "List-Unsubscribe=One-Click" to the List-Unsubscribe URL without showing
 * the customer a page, so this answers with a bare status.
 */
export async function POST(req: Request) {
  const email = verified(new URL(req.url));
  if (!email) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  await optOut(email);
  return NextResponse.json({ unsubscribed: true });
}
