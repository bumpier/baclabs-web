// Throwaway smoke test for the middleware auth redirects. Run with:
//   npx tsx scripts/smoke-middleware-redirect.ts
//
// Guards the fix for the /admin → localhost:3000 redirect leak: the middleware
// must build its (absolute, as Next requires) redirect from X-Forwarded-Host —
// the public domain nginx forwards — never from the internal upstream host.
//
// NOTE: this calls middleware() directly, so it verifies WHICH host ends up in
// the Location header. It does NOT exercise Next's middleware runtime (which
// rejects relative Locations). The dev-server probe in the PR is what guards
// against the 500 itself.
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "../middleware";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

process.env.JWT_SECRET = "smoke-secret";
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Simulate a request as nginx forwards it: the raw Host is the internal upstream
// (the value that used to leak), while X-Forwarded-Host carries the public domain.
function req(path: string, cookie?: string): NextRequest {
  const headers = new Headers({
    host: "127.0.0.1:3000",
    "x-forwarded-host": "baclab.example",
    "x-forwarded-proto": "https",
  });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(`http://127.0.0.1:3000${path}`), { headers });
}

async function packerToken(): Promise<string> {
  return new SignJWT({ admin: true, role: "PACKER" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
}

async function run() {
  // 1. Unauthenticated /admin → login on the PUBLIC host
  {
    const res = await middleware(req("/admin"));
    assert(res.status === 307, "unauth /admin returns 307");
    assert(
      res.headers.get("location") === "https://baclab.example/admin/login",
      "unauth /admin → https://baclab.example/admin/login (forwarded host)"
    );
  }

  // 2. Packer hitting a non-orders admin page → orders on the public host
  {
    const token = await packerToken();
    const res = await middleware(req("/admin", `admin_session=${token}`));
    assert(res.status === 307, "packer /admin returns 307");
    assert(
      res.headers.get("location") === "https://baclab.example/admin/orders",
      "packer /admin → https://baclab.example/admin/orders"
    );
  }
  // 3. /dashboard is no longer guarded — the affiliate area is gone, and
  // next.config.js now 301s it to the funnel instead.
  {
    const res = await middleware(req("/dashboard"));
    assert(res.status === 200, "middleware no longer intercepts /dashboard");
  }

  // 4. The core regression guard: no redirect may carry the internal host.
  for (const path of ["/admin", "/admin/products"]) {
    const loc = (await middleware(req(path))).headers.get("location") ?? "";
    assert(
      !loc.includes("127.0.0.1") && !loc.includes("localhost:3000"),
      `${path} redirect Location carries no internal host`
    );
  }

  console.log("\nAll middleware-redirect assertions passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
