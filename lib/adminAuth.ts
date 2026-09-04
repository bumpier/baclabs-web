import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

// Single-credential admin auth. ADMIN_PASSWORD may be either a bcrypt
// hash (starts with $2) or a plain value that is bcrypt-hashed once at
// boot — it is never compared as plain text.

const ADMIN_COOKIE = "admin_session";
const ADMIN_SESSION_HOURS = 2; // expires after 2h of inactivity (middleware refreshes)

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return new TextEncoder().encode(s);
}

let cachedHash: string | null = null;

async function adminPasswordHash(): Promise<string> {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) throw new Error("ADMIN_PASSWORD is not set");
  if (configured.startsWith("$2")) return configured;
  if (!cachedHash) cachedHash = await bcrypt.hash(configured, 12);
  return cachedHash;
}

export async function verifyAdminPassword(input: string): Promise<boolean> {
  return bcrypt.compare(input, await adminPasswordHash());
}

export async function createAdminSession() {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
    .sign(secret());

  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_HOURS * 3600,
    path: "/",
  });
}

export async function destroyAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.admin === true;
  } catch {
    return false;
  }
}

/** Server-side admin check — call at the top of every admin route/action. */
export async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || !(await isAdminToken(token))) {
    throw new Error("Unauthorised");
  }
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!token && (await isAdminToken(token));
}

export type AdminRole = "ADMIN" | "PACKER";

/** Create a session for an AdminUser (stores role + id in JWT). */
export async function createAdminUserSession(adminUser: {
  id: string;
  role: string;
}): Promise<void> {
  const role: AdminRole = adminUser.role === "PACKER" ? "PACKER" : "ADMIN";
  const token = await new SignJWT({ admin: true, role, adminUserId: adminUser.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
    .sign(secret());

  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_HOURS * 3600,
    path: "/",
  });
}

/** Returns session info from cookie. Legacy env-var tokens (no role field) are treated as ADMIN. */
export async function getAdminSession(): Promise<{
  role: AdminRole;
  adminUserId?: string;
} | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.admin !== true) return null;
    const role: AdminRole =
      (payload.role as string) === "PACKER" ? "PACKER" : "ADMIN";
    return {
      role,
      adminUserId: payload.adminUserId as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Throws if the current session is not authenticated OR if `role` is 'ADMIN'
 * and the session belongs to a Packer.
 * Use requireAdmin() for packer-accessible routes (it only checks admin===true).
 * Use requireAdminRole('ADMIN') for Admin-only routes.
 */
export async function requireAdminRole(role: AdminRole = "ADMIN"): Promise<void> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorised");
  if (role === "ADMIN" && session.role !== "ADMIN") throw new Error("Unauthorised");
}
