# BacLab — white-label e-commerce storefront

A self-contained e-commerce site for physical products with a built-in admin
panel, an invite-only affiliate programme, and crypto payments
(Bitcoin, Ethereum, USDT, Monero) via a self-hosted gateway.

Stack: Next.js 15 (App Router) · SQLite via Prisma · Tailwind CSS · Jose + bcrypt · optional Resend email.

## Quick start

```bash
cp .env.example .env.local      # fill in values (see below)
echo 'DATABASE_URL="file:../data/baclab.db"' > .env   # Prisma CLI reads .env
npm install
npx prisma migrate dev          # creates data/baclab.db
npx prisma db seed              # 4 sample products
npm run dev                     # http://localhost:3000
```

Generate secrets:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
```

`ADMIN_PASSWORD` may be plain (hashed in memory at boot) or a pre-computed
bcrypt hash (`$2…`). Admin panel: `/admin`.

## White-labelling

Everything brand-related lives in **`config/brand.ts`** — name, tagline,
colours, currencies, contact details, packing-slip message. The full colour
palette (tints, shades, ink, paper) is derived automatically from
`primaryColor` + `accentColor`. To rebrand:

1. Edit `config/brand.ts`
2. Replace `public/logo.svg`

Fonts are the one exception (`next/font` needs literal names): swap the two
imports in `app/fonts.ts`.

## Payments (crypto only)

Payment is crypto-only: Bitcoin, Ethereum, USDT and Monero, handled by a
self-hosted gateway (`CRYPTO_GATEWAY_URL` — REQUIRED, no default; unset it and
the crypto methods do not appear at checkout).
`lib/crypto-gateway.ts` + `lib/crypto-rates.ts` are the integration points.

**Checkout → payment.** `createCryptoPayment` converts the order's USD subtotal
to the chosen coin (USDT 1:1; BTC/ETH/XMR via a live CoinGecko rate, cached 60s —
the gateway charges the *exact* crypto amount and does no fiat conversion itself),
then `POST {CRYPTO_GATEWAY_URL}/create-payment` with `{ amount, orderId, currency }`.
The gateway returns a deposit `wallet`, exact `amount`, a `qr` and `expiresAt` (no
hosted page), which we stash on the order and render on our own pay screen
`/checkout/pay/[id]` — address + QR + countdown. That page polls
`/api/order-status/[id]` and auto-advances to the confirmation page once the
webhook marks the order paid.

**Confirmation.** Confirmations arrive as a signed server-to-server webhook at
`/api/crypto-webhook`. The gateway signs the **raw request body** and sends
`X-Webhook-Signature: sha256=HMAC-SHA256(CRYPTO_WEBHOOK_SECRET, rawBody)`; the
handler verifies that over the raw bytes (constant-time) **before** parsing —
missing/invalid signature → 401, unset secret → 500. Then, only for a
`payment.confirmed` event whose `payment.status` is `"confirmed"`, it marks the
order paid, decrements stock, records the paymentId / txHash / currency / amount
on the order (JSON in `notes`), and creates the affiliate commission — never
client-side. It is idempotent (retries and already-paid orders are no-ops) and
acknowledges test pings (`test: true`) and unknown orders with `200` without
fulfilling. Set `CRYPTO_WEBHOOK_SECRET` (it MUST equal the gateway's
`WEBHOOK_SECRET`) in `.env.local`.

Smoke tests (webhook verifier + idempotency; USD→crypto conversion + notes):

```bash
DATABASE_URL=file:$(pwd)/data/baclab.db npx tsx scripts/smoke-crypto-webhook.ts
DATABASE_URL=file:$(pwd)/data/baclab.db npx tsx scripts/smoke-crypto-pay.ts
```

## Repurchase nudge emails

Products with `supplyDays > 0` (admin → product form) trigger an automatic
"time to restock" email: `orderDate + min(qty × supplyDays) − 4 days`.
Customers who placed a newer order, or who unsubscribed, are skipped; each
order is nudged at most once (enforced by the `EmailLog` unique constraint).
Order confirmation / shipped / delivered emails are sent automatically from
the payment webhooks and the admin status buttons.

Schedule the daily job on the server:

```cron
15 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron/nudges
```

## Email setup (Resend)

Transactional emails (verification, password reset, order confirmation, shipped/delivered, nudges) go through [Resend](https://resend.com) via its HTTP API — see `lib/email.ts`.

**Email is optional.** Leave `RESEND_API_KEY` blank and the app runs normally — password reset is hidden, and order/affiliate notification emails are skipped. The steps below are only needed if you want email.

1. In the Resend dashboard, **Domains → Add Domain** and add the DNS records it shows (DKIM/SPF, plus DMARC)
2. **API Keys → Create API Key** with *sending access*
3. Set `RESEND_API_KEY` in `.env.local`, and set `EMAIL_FROM` to an address **on the verified domain** — Resend rejects anything else, and `lib/email.ts` refuses to send while it still contains `example.com`
4. In dev mode with no API key, emails print to the console

## Affiliate programme

- Admin generates a single-use, 48-hour invite at `/admin/affiliates/invite`
- Affiliate registers via the link, verifies email, gets `/dashboard`
- Referral links: `https://yoursite.com/?ref=CODE` → 30-day cookie, last-click wins
- Commissions are created **only** by the payment webhook (order → paid),
  tracked in USDT (calculated from the order's USD subtotal — USDT is
  dollar-pegged), and reviewed (approve/reject) in the admin panel
- Payouts: affiliate requests when balance ≥ `AFFILIATE_MIN_PAYOUT_USDT`;
  admin sends USDT on TRC20 manually within 24–48 hours, records the tx
  hash, and marks paid
- The affiliate's USDT (TRC20) wallet address is AES-256-GCM encrypted at rest

## Useful paths

| Path | Purpose |
|---|---|
| `config/brand.ts` | All branding (white-label) |
| `prisma/schema.prisma` | Database schema |
| `lib/crypto-gateway.ts` | Crypto gateway: webhook verify + (stub) invoice create |
| `lib/affiliate.ts` | Commission lifecycle |
| `app/admin/*` | Admin panel |
| `data/baclab.db` | SQLite database (never web-accessible) |

## Deployment note

SQLite + local file uploads require a host with a persistent filesystem (a
VPS, Fly.io volume, Railway volume, etc.). On Vercel the filesystem is
ephemeral — to deploy there, swap SQLite for a hosted database (e.g. Neon
Postgres via the Vercel Marketplace: change the Prisma `provider`, keep the
schema) and move uploads to Vercel Blob.

## Pre-launch checklist

See the security checklist in `docs/CLAUDE.md` §12. Already wired in:
security headers, bcrypt admin auth + lockout, Zod validation on every
input, webhook signature verification, UUID order IDs, rate limiting,
generic error responses, httpOnly/sameSite cookies, encrypted wallet addresses.
