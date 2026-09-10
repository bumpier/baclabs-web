import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { originFromHeaders } from "@/lib/site-url";
import { blogOrigin, isMigratedPath } from "@/lib/blog-migration";

// Server-side gatekeeper for /admin/*.
//
// The affiliate referral capture (?ref= / ?recruiter= cookies) and the
// /dashboard guard have been removed along with the affiliate programme.
// Security headers live in next.config.js, not here.

const ADMIN_SESSION_HOURS = 2;

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

// Redirect within the same public origin the visitor is actually on.
// Next's middleware runtime requires an ABSOLUTE redirect URL, so we build one
// from originFromHeaders() — which prefers X-Forwarded-Host (forwarded by nginx)
// over the raw Host. Using req.nextUrl instead would leak the internal upstream
// host (localhost:3000) into the Location header.
function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, originFromHeaders(req.headers)));
}

async function getAdminTokenRole(token: string | undefined): Promise<"ADMIN" | "PACKER" | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.admin !== true) return null;
    return (payload.role as string) === "PACKER" ? "PACKER" : "ADMIN";
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ── The blog and guides have moved to their own domain (see
  // lib/blog-migration.ts). 301, not 307: these are permanent moves and a
  // permanent status is what transfers ranking signals to the new URL. The
  // path and query are preserved, so /guides/how-to-store-... lands on the
  // same slug at the destination rather than on its home page - a redirect
  // to the wrong page is treated as a soft 404 and passes nothing on.
  const movedTo = blogOrigin();
  if (movedTo && isMigratedPath(pathname)) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, movedTo), 301);
  }

  // ── Admin protection (everything under /admin except the login page)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get("admin_session")?.value;
    const role = await getAdminTokenRole(token);

    if (!role) {
      return redirectTo(req, "/admin/login");
    }

    // Packers are restricted to /admin/orders and /admin/orders/*
    if (role === "PACKER" && !pathname.startsWith("/admin/orders")) {
      return redirectTo(req, "/admin/orders");
    }

    // Sliding expiry: re-issue token preserving role
    const res = NextResponse.next();
    const refreshPayload: Record<string, unknown> = { admin: true };
    if (role === "PACKER") refreshPayload.role = "PACKER";
    const refreshed = await new SignJWT(refreshPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
      .sign(secret());
    res.cookies.set("admin_session", refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: ADMIN_SESSION_HOURS * 3600,
      path: "/",
    });
    return res;
  }

  return NextResponse.next();
}

// Scoped as tightly as possible: the funnel is a static prerender and running
// middleware on it would make every visit dynamic. /guides and /blog are added
// only because they are already force-dynamic (they read the database), so
// matching them costs nothing that was not already being paid.
export const config = {
  matcher: ["/admin/:path*", "/guides/:path*", "/blog/:path*"],
};
