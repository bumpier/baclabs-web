import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SubscribeSchema, verifyOrigin } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { MAILING_LIST } from "@/config/funnel";
import { sendWelcomeEmail } from "@/lib/customer-email";
import {
  SUBSCRIBER_COOKIE,
  SUBSCRIBER_COOKIE_MAX_AGE,
  bonusOffer,
  hashIp,
  normEmail,
  previousOrderCount,
  signSubscriberToken,
  subscriberFromCookie,
  welcomeEligible,
  welcomeVialOn,
} from "@/lib/mailing-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The mailing-list signup (components/mailing-list/SignupForm.tsx).
//
// Every outcome answers the same { ok: true }: a bot, an address already on
// the list and a new signup look identical from outside, so this cannot be
// used to find out who is subscribed.

const OK = () => NextResponse.json({ ok: true });

export async function POST(req: Request) {
  if (!MAILING_LIST.enabled) return NextResponse.json({ error: "Not available" }, { status: 404 });
  if (!verifyOrigin(req)) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 403 });
  }
  const ip = req.headers.get("cf-connecting-ip") ?? clientIp(req);
  if (!rateLimit(`subscribe:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (parsed.data.website) return OK(); // honeypot

  const email = normEmail(parsed.data.email);
  try {
    const existing = await prisma.subscriber.findUnique({ where: { email } });
    // Already on the list: nothing to do, and no second welcome email, so
    // the form cannot be used to send someone mail over and over.
    if (existing?.status === "subscribed") return OK();

    const consent = {
      status: "subscribed",
      source: parsed.data.source,
      consentText: MAILING_LIST.consentText,
      consentAt: new Date(),
      ipHash: hashIp(ip),
      unsubscribedAt: null,
    };
    const sub = existing
      ? await prisma.subscriber.update({ where: { id: existing.id }, data: consent })
      : await prisma.subscriber.create({ data: { email, ...consent } });
    // A fresh, explicit opt-in overrides an earlier unsubscribe.
    await prisma.emailOptOut.deleteMany({ where: { email } });

    const withOffer = welcomeEligible(sub, await previousOrderCount(email));
    void sendWelcomeEmail(sub, { withOffer });

    const res = OK();
    res.cookies.set(SUBSCRIBER_COOKIE, signSubscriberToken(sub.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SUBSCRIBER_COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[mailing-list] signup failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/**
 * Whether this browser signed up (or followed an email's link), whether its
 * welcome vial is still waiting, and the reminder bonus on top of it while
 * that is open. Read by the popup (to stay closed) and the buy blocks (to
 * show the free vials), from the browser, because the storefront pages are
 * static and cannot read the cookie themselves.
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const none = { subscribed: false, welcome: false, bonus: null };
  try {
    const sub = await subscriberFromCookie(req.headers.get("cookie"));
    if (!sub || sub.status !== "subscribed") {
      return NextResponse.json(none, { headers });
    }
    const welcome = welcomeVialOn() && welcomeEligible(sub, await previousOrderCount(sub.email));
    return NextResponse.json({ subscribed: true, welcome, bonus: welcome ? bonusOffer(sub) : null }, { headers });
  } catch {
    return NextResponse.json(none, { headers });
  }
}
