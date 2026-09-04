// Throwaway smoke test for the outbound crypto-payment pieces. Run with:
//   DATABASE_URL=file:$(pwd)/data/baclab.db npx tsx scripts/smoke-crypto-pay.ts
//
// Pure logic only (no network): USD→crypto conversion + amount formatting, and
// the pending-payment note round-trip used by the /checkout/pay/[id] page.

import { formatCryptoAmount, usdToCryptoAmount } from "../lib/crypto-rates";
import {
  buildPendingNote,
  parsePendingNote,
  buildAuditNote,
  type CryptoPaymentDetails,
} from "../lib/crypto-gateway";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

async function main() {
  // ── formatCryptoAmount: precision + trailing-zero trim ───────────
  assert(formatCryptoAmount(0.0015, 8) === "0.0015", "btc precision trims trailing zeros");
  assert(formatCryptoAmount(90, 2) === "90", "integer USDT trims to '90'");
  assert(formatCryptoAmount(0.03, 8) === "0.03", "eth precision");
  assert(formatCryptoAmount(1.23456789, 8) === "1.23456789", "8dp preserved");
  let threw = false;
  try { formatCryptoAmount(0, 8); } catch { threw = true; }
  assert(threw, "zero amount rejected");

  // ── usdToCryptoAmount: USDT 1:1, others use injected price ───────
  assert((await usdToCryptoAmount(90, "usdt")) === "90", "USDT is 1:1");
  assert((await usdToCryptoAmount(90, "btc", 60000)) === "0.0015", "USD→BTC @60000 = 0.0015");
  assert((await usdToCryptoAmount(90, "eth", 3000)) === "0.03", "USD→ETH @3000 = 0.03");
  assert((await usdToCryptoAmount(150, "xmr", 150)) === "1", "USD→XMR @150 = 1");

  // ── pending note round-trip ──────────────────────────────────────
  const details: CryptoPaymentDetails = {
    paymentId: "pay_abc",
    wallet: "bc1qexample",
    amount: "0.0015",
    currency: "BTC",
    qr: "data:image/png;base64,AAAA",
    expiresAt: "2026-06-18T15:50:00.000Z",
  };
  const note = buildPendingNote(details);
  const parsed = parsePendingNote(note);
  assert(parsed !== null, "pending note parses");
  assert(parsed!.paymentId === "pay_abc" && parsed!.wallet === "bc1qexample", "paymentId + wallet round-trip");
  assert(parsed!.amount === "0.0015" && parsed!.currency === "BTC", "amount + currency round-trip");
  assert(parsed!.qr === details.qr && parsed!.expiresAt === details.expiresAt, "qr + expiry round-trip");

  // ── parsePendingNote rejects non-pending notes ───────────────────
  assert(parsePendingNote(null) === null, "null notes → null");
  assert(parsePendingNote("Crypto payment (BTC)") === null, "plain text note → null");
  const audit = buildAuditNote({
    paymentId: "pay_x",
    orderId: "o",
    currency: "BTC",
    amount: "0.001",
    status: "confirmed",
    txHash: "0xabc",
  });
  assert(parsePendingNote(audit) === null, "audit (confirmed) note is not treated as pending");

  console.log("\nAll smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
