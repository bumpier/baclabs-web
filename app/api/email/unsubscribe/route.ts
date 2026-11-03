import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unsubscribeSig } from "@/lib/customer-email";
import { optOut as optOutOf } from "@/lib/opt-outs";
import { brandFor, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import { escapeHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

// Unsubscribe from marketing emails (nudges, review requests, campaigns). The link carries an
// HMAC of the email address, so no per-recipient token storage is needed.
//
// One brand at a time: the link names the brand whose email it came in
// (unsubscribeUrl in lib/customer-email.ts), and only that brand stops.
// BacLab's links name none, as they always have.

function page(b: BrandProfile, title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
     <body style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#1b2b24">
       <h2>${escapeHtml(b.name)}</h2><p>${body}</p>
     </body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

/**
 * The brand the link names. No `brand` is BacLab; a brand that is not
 * registered is null, so a stale or edited link is refused rather than read
 * as BacLab's.
 */
function linkBrand(url: URL): BrandProfile | null {
  const raw = url.searchParams.get("brand");
  if (raw === null) return brandFor(DEFAULT_BRAND);
  const b = brandFor(raw);
  return b.id === raw ? b : null;
}

/** The lower-cased email and its brand, if the signature is ours; otherwise null. */
function verified(url: URL): { email: string; brand: BrandProfile } | null {
  const email = (url.searchParams.get("email") ?? "").toLowerCase();
  const sig = url.searchParams.get("sig") ?? "";
  const brand = linkBrand(url);
  if (!email || !sig || !brand) return null;
  const expected = Buffer.from(unsubscribeSig(email, brand.id), "hex");
  const given = Buffer.from(sig, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { email, brand };
}

/**
 * Opt out of every marketing email from this brand: nudges, review requests
 * and campaigns all check EmailOptOut. The brand's mailing-list subscriber
 * is marked unsubscribed as well, so the admin list shows it.
 */
async function optOut(email: string, brand: string): Promise<void> {
  await optOutOf(email, brand);
  await prisma.subscriber.updateMany({
    where: { brand, email, status: "subscribed" },
    data: { status: "unsubscribed", unsubscribedAt: new Date() },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const link = verified(url);
  if (!link) return page(linkBrand(url) ?? brandFor(DEFAULT_BRAND), "Invalid link", "This unsubscribe link is invalid.", 400);

  await optOut(link.email, link.brand.id);

  return page(
    link.brand,
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
  const link = verified(new URL(req.url));
  if (!link) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  await optOut(link.email, link.brand.id);
  return NextResponse.json({ unsubscribed: true });
}
