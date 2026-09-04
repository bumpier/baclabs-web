// In-memory sliding-window rate limiter. Good enough for a single
// instance; swap the Map for SQLite if running multiple instances.

type Bucket = { timestamps: number[]; lockedUntil: number };

const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { timestamps: [], lockedUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

// Periodically drop stale buckets so the map doesn't grow unbounded
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 10 * 60_000) return;
  lastSweep = now;
  buckets.forEach((b, k) => {
    if (b.lockedUntil < now && (b.timestamps[b.timestamps.length - 1] ?? 0) < now - 30 * 60_000) {
      buckets.delete(k);
    }
  });
}

/** Returns true if the request is allowed. */
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = getBucket(key);
  b.timestamps = b.timestamps.filter((t) => t > now - windowMs);
  if (b.timestamps.length >= maxRequests) return false;
  b.timestamps.push(now);
  return true;
}

/**
 * Failed-attempt lockout: after `maxFails` failures within `windowMs`,
 * the key is locked for `lockMs`. Used for admin/affiliate login.
 */
export function isLockedOut(key: string): boolean {
  return getBucket(`lock:${key}`).lockedUntil > Date.now();
}

export function recordFailure(key: string, maxFails = 5, windowMs = 15 * 60_000, lockMs = 15 * 60_000) {
  const now = Date.now();
  const b = getBucket(`lock:${key}`);
  b.timestamps = b.timestamps.filter((t) => t > now - windowMs);
  b.timestamps.push(now);
  if (b.timestamps.length >= maxFails) {
    b.lockedUntil = now + lockMs;
    b.timestamps = [];
  }
}

export function clearFailures(key: string) {
  buckets.delete(`lock:${key}`);
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
