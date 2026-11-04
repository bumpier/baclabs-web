import { NextResponse } from "next/server";

/**
 * Every /api path no route handles. /api is shared by every site and is
 * not rewritten on a brand host (lib/brand/resolve.ts), so without this an
 * unknown /api path fell through to app/global-not-found.tsx and showed a
 * brand's visitor BacLab's 404 page. A bare JSON 404 names no site. Real
 * routes always match before a catch-all, so none of them change.
 */
export const dynamic = "force-dynamic";

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const GET = notFound;
export const HEAD = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
