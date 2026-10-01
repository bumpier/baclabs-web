import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { originFromHeaders } from "@/lib/site-url";
import { MAILING_LIST, bundleById } from "@/config/funnel";
import { packByBundleId, packPath } from "@/config/products";
import {
  SUBSCRIBER_COOKIE,
  SUBSCRIBER_COOKIE_MAX_AGE,
  cookieFrom,
  isLinkToken,
  readSubscriberToken,
} from "@/lib/mailing-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where the button in the welcome email and its reminders points
// (welcomeLink in lib/mailing-list.ts). Most people open the email on a
// different device, or in a different browser, from the one they signed up
// in, and that one has no signup cookie: the site would offer them the signup
// form again and the payment page would show no free vial. This sets the
// cookie from the link's token, then sends them on to buy.
//
// It writes nothing to the database, so a mail scanner fetching the link
// ahead of its reader changes nothing. A token we did not sign, or no token,
// is simply sent on without a cookie: the vial is still added after payment
// when the order's email matches.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bundle = bundleById(url.searchParams.get("pack") ?? "");
  const pack = bundle ? packByBundleId(bundle.id) : undefined;
  const res = NextResponse.redirect(new URL(pack ? packPath(pack) : "/#buy", originFromHeaders(req.headers)));
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");

  const token = url.searchParams.get("t");
  const id = MAILING_LIST.enabled && isLinkToken(token) ? readSubscriberToken(token) : null;
  if (!token || !id) return res;
  const ip = req.headers.get("cf-connecting-ip") ?? clientIp(req);
  if (!rateLimit(`subscribe-link:${ip}`, 30, 60_000)) return res;

  // The browser that signed up keeps its own cookie: it proves more than a
  // link does (see isLinkToken).
  const current = readSubscriberToken(cookieFrom(req.headers.get("cookie"), SUBSCRIBER_COOKIE));
  if (current === id) return res;

  res.cookies.set(SUBSCRIBER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SUBSCRIBER_COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
