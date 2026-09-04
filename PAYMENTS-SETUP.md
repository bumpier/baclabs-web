# Payments — operator setup

The store takes **cards** (Stripe) and, optionally, **crypto** (a self-hosted
gateway addressed by `CRYPTO_GATEWAY_URL`). They are independent: either can be
switched off without affecting the other.

Crypto has **no default gateway**. Leave `CRYPTO_GATEWAY_URL` unset and the
crypto methods simply do not appear at checkout.

## Turning card payments on

1. In the Stripe Dashboard, copy your **Secret key** (`sk_live_…`).
2. Add a webhook endpoint pointing at
   `https://baclab.co.uk/api/webhooks/stripe`, subscribed to the single
   event **`checkout.session.completed`**. Copy its **Signing secret**
   (`whsec_…`).
3. On the server, edit `/srv/baclab/.env.local`:

   ```
   STRIPE_ENABLED=true
   STRIPE_SECRET_KEY=sk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```

4. Restart: `cd /srv/baclab && docker compose --env-file .env.local up -d`
5. Confirm: place a small real order and check it appears as **paid** in
   `/admin/orders`.

## Turning card payments off (the kill switch)

```
STRIPE_ENABLED=false
```

then `cd /srv/baclab && docker compose --env-file .env.local up -d`. A few
seconds of downtime while the container restarts. The Card
option disappears from checkout immediately and the API refuses card orders.
**Crypto is unaffected and keeps taking orders.**

**Flip the flag — never delete the keys.** Without them the webhook endpoint
cannot verify anything and returns 500, so already-captured payments sit
unfulfilled while Stripe retries. `STRIPE_ENABLED=false` stops new card orders
and leaves the webhook able to finish the ones already in flight.

Do this straight away if Stripe emails about an account review or initiates a
compliance review. This catalogue is subject to Stripe's restrictions and account
termination is a realistic outcome — the kill switch is your immediate response.

## What currency customers are charged

**GBP, always.** One UK seller, one authored price — there is no currency
switcher and no per-country pricing (`config/brand.ts`). USD exists in the code
only because the crypto gateway settles in USD, so `lib/fx.ts` converts into it;
it is never shown to a shopper.

Checkout sessions are pinned to **cards only**. Delayed-notification methods
(SEPA debit, Bancontact, Klarna) settle hours or days after checkout, via an
event this store does not handle, so they are never offered.

## Checking it without real money

With `STRIPE_ENABLED=true` and **no** keys set, in development only, checkout
redirects to `/dev/stripe` — a local simulator with "succeed" and "fail"
buttons that runs the real fulfilment code path.

Automated check:

```bash
DATABASE_URL=file:$(pwd)/data/baclab.db npx tsx scripts/smoke-stripe.ts
```

## Troubleshooting

**Card option missing at checkout.** Either `STRIPE_ENABLED` is not exactly
`true`, or a key is missing. The server log prints the reason at startup —
look for a line beginning `[payments]`.

**Orders stay pending after a successful card payment.** The webhook is not
arriving. Check Stripe Dashboard → Developers → Webhooks for delivery failures.

- **400** — a genuine signature mismatch: `STRIPE_WEBHOOK_SECRET` is not this
  endpoint's signing secret. Copy it again from the endpoint's page.
- **500** — `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is missing from
  `/srv/baclab/.env.local`. Stripe keeps retrying for three days, so restoring
  the keys and restarting recovers the orders. The server log names the missing
  key.
- **Delivered 200 but the order is still pending** — look for a
  `livemode mismatch` line in the server log: a test-mode endpoint's signing
  secret is configured on the live deployment (or the reverse).
