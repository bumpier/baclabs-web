import { NextResponse } from "next/server";
import { ContactSchema, verifyOrigin } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { recordContactMessage } from "@/lib/contact-inbox";
import { CONTACT_EMAIL } from "@/lib/contact";
import { brandFromHost, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The contact form (components/contact/ContactForm.tsx). Spam is kept out
// the same way as the mailing-list signup: same-origin only, a honeypot that
// is answered as if it worked, and a per-IP limit.
//
// The message is stored against the brand whose site it was sent from, read
// from the Host (never the body), and goes to that brand's inbox
// (lib/contact-inbox.ts). Unknown hosts are BacLab, as they always were.

const FAILED = `Your message could not be sent. Please try again, or email ${CONTACT_EMAIL}.`;
const TOO_MANY = `You have sent a few messages in a short time. Please wait a few minutes, or email ${CONTACT_EMAIL}.`;

// BacLab's messages are exactly as they were. Another brand's point to its
// own inbox, or to none while it has none: never to BacLab's.
const failed = (b: BrandProfile) =>
  b.id === DEFAULT_BRAND
    ? FAILED
    : `Your message could not be sent. Please try again${b.email.inbox ? `, or email ${b.email.inbox}` : ""}.`;

const tooMany = (b: BrandProfile) =>
  b.id === DEFAULT_BRAND
    ? TOO_MANY
    : `You have sent a few messages in a short time. Please wait a few minutes${b.email.inbox ? `, or email ${b.email.inbox}` : ""}.`;

export async function POST(req: Request) {
  const brand = brandFromHost(req.headers.get("host"));
  if (!verifyOrigin(req)) {
    return NextResponse.json({ error: failed(brand) }, { status: 403 });
  }
  const ip = req.headers.get("cf-connecting-ip") ?? clientIp(req);
  if (!rateLimit(`contact:${ip}`, 3, 10 * 60_000)) {
    return NextResponse.json({ error: tooMany(brand) }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: failed(brand) }, { status: 400 });
  }
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    // The form checks the same rules before sending, so this is the
    // fallback for a request that skipped it.
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true }); // honeypot

  try {
    const { website: _honeypot, ...input } = parsed.data;
    await recordContactMessage({ ...input, brand: brand.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] could not store message", err);
    return NextResponse.json({ error: failed(brand) }, { status: 500 });
  }
}
