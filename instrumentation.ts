// Runs once per server start (Next.js instrumentation). Surfaces payment
// misconfiguration in the logs so a non-technical operator notices immediately.
//
// Next.js also invokes register() for the edge runtime (because middleware.ts
// exists), and lib/payments/config.ts pulls in lib/crypto-gateway.ts, which
// imports Node's "crypto" — unavailable at edge. Guard to nodejs only.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warnMisconfiguredPayments } = await import("./lib/payments/config");
    warnMisconfiguredPayments();
  }
}
