import { NextResponse } from "next/server";
import { ContactSchema, verifyOrigin } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { recordContactMessage } from "@/lib/contact-inbox";
import { CONTACT_EMAIL } from "@/lib/contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The contact form (components/contact/ContactForm.tsx). Spam is kept out
// the same way as the mailing-list signup: same-origin only, a honeypot that
// is answered as if it worked, and a per-IP limit.

const FAILED = `Your message could not be sent. Please try again, or email ${CONTACT_EMAIL}.`;

export async function POST(req: Request) {
  if (!verifyOrigin(req)) {
    return NextResponse.json({ error: FAILED }, { status: 403 });
  }
  const ip = req.headers.get("cf-connecting-ip") ?? clientIp(req);
  if (!rateLimit(`contact:${ip}`, 3, 10 * 60_000)) {
    return NextResponse.json(
      { error: `You have sent a few messages in a short time. Please wait a few minutes, or email ${CONTACT_EMAIL}.` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: FAILED }, { status: 400 });
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
    await recordContactMessage(input);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] could not store message", err);
    return NextResponse.json({ error: FAILED }, { status: 500 });
  }
}
