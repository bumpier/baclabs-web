# Taking payment on the new brands

Every brand takes cards through **Stripe, on BacLab's own Stripe account**:
the same account, the same key, the same webhook. That covers beauty, gym,
wholesale and luxury alike (the owner's decision, 4 Nov 2026). The provider
can be changed later, one brand at a time, by config alone (see "Switching
a brand to PayPal later").

BacLab's own checkout is exactly as it was: its Stripe Prices, its
sessions, its emails and its pages. The brands' sessions are built
separately, from each brand's own catalogue
(`lib/commerce/payments/stripe.ts`).

## How it works

- **The session:** the brand's checkout writes the order, then makes a
  Stripe Checkout Session for it. Each line is priced from the brand's
  catalogue and named neutrally ("10ml bacteriostatic water × 3"). The
  delivery the buyer chose on the brand's page is the one fixed shipping
  rate, at its price. The session carries `{ orderId, brand, kind: "brand" }`
  as metadata, and the profile's `statementDescriptor` as its statement
  suffix.
- **The webhook:** BacLab's own endpoint (`/api/webhooks/stripe`) confirms
  it, as it confirms BacLab's. It finds the order, checks the brand and the
  amount, writes the address and the delivery instructions, and marks the
  order paid. There is no second webhook to set up.
- **When it is on:** while BacLab's cards are on (`STRIPE_ENABLED=true`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and the brand's profile lists
  `"stripe"`. There is no per-brand key and no `STRIPE_*__<ID>`.
  `STRIPE_ENABLED=false` turns off every brand's card checkout along with
  BacLab's.
- **The checkout button:** follows the profile alone. A brand that lists
  `"stripe"` shows it on every page from the moment it is deployed, because
  the pages are prerendered by the Docker build, which never has the Stripe
  keys (and must not: they are runtime secrets). Whether a payment can be
  taken is checked when the customer presses it: with BacLab's cards off,
  the button stays and the checkout answers *"Checkout is not available
  right now."* (503), as BacLab's own checkout refuses cards while they are
  off. A brand that lists no provider shows no button at all.

## The rules

1. **Declare every brand site to Stripe before it takes a payment.**
   - **Why:** taking card payments for a website the processor has not been
     told about is what the card schemes' rules treat as transaction
     laundering. It can end with the account closed (BacLab's too, since
     it is the same account) and the company listed so that no other
     processor will take it on.
   - **When:** before the brand's profile lists `"stripe"` in a deploy that
     reaches its live domain.
2. **Only neutral words reach Stripe.** Line names, the statement
   descriptor and the delivery names are the same plain words on every
   brand, and never a brand's own copy. The brand's name and colours appear
   only as the branding of Stripe's page, and only once its origin is https.
   `npm run test:brand-checkout` holds every string a brand sends to Stripe
   to the content rules and to the gym's rules.
3. **No promotion codes on a brand's order.** The codes on the account are
   BacLab's; the brands' sessions never take one, and a brand campaign
   cannot create one.

## Setting it up

Once, on BacLab's Stripe account, before the first brand takes a payment:

1. **Declare each brand site.**
   - **Where:** in the Dashboard, *Settings → Business → Business details*.
   - **What:** each brand's domain, what it sells (10ml bacteriostatic
     water, sold as a laboratory reagent), and that one company runs it and
     BacLab.
   - **If the form takes only one website:** write to Stripe support with
     the full list.
   - **Then:** keep Stripe's written confirmation with the brand's records.
     Do the same for every brand added later, before it takes a payment.
2. **Set a neutral shortened descriptor.**
   - **Why:** Stripe prints a brand's card payment as
     `<shortened descriptor>* <statementDescriptor>`, for example
     `ABC LTD* AURELLE`. Unset, Stripe uses the start of the account's
     statement descriptor, which is BacLab's name, so every brand's buyers
     would see BacLab on their statements.
   - **Where:** *Settings → Business → Public details*, "Shortened
     descriptor".
   - **What:** 2 to 10 characters, at least one letter, nothing of
     BacLab's.
   - **Length:** any Stripe allows. Every brand descriptor today is 10
     characters or fewer (the longest is `RESERVE 10`), so each still fits
     Stripe's 22 after a 10-character prefix and the `* `.
   - **Then:** record it in `STRIPE_STATEMENT_PREFIX`
     (`lib/commerce/payments/stripe.ts`). `npm run check:brands` checks
     every brand's descriptor against it, and keeps the brands "not ready
     for launch" until it is recorded.
   - **Check BacLab's own statement:** BacLab's sessions send no suffix.
     Stripe's page does not say what such a payment prints once a prefix is
     set. Before and after setting it, open a BacLab test-mode payment in
     the Dashboard and compare its calculated statement descriptor.
3. **Turn Stripe's own receipt emails off.**
   - **Why:** each brand already sends its own confirmation, from its own
     address. Stripe's receipt would carry the account's name and
     branding, which are BacLab's.
   - **Where:** *Settings → Business → Customer emails*: turn off
     "Successful payments" (and "Refunds").
   - **BacLab too:** this is account-wide, so BacLab's customers stop
     getting Stripe's receipt as well. BacLab's order confirmation page
     still says "Stripe also emails its own payment receipt"
     (`app/(baclab)/(store)/order-confirmation/[id]/page.tsx`); that line
     needs removing in a BacLab change when this is switched off.

Nothing else is configured: no key, no webhook, no env var.

Then, for each brand, in its profile (`brands/<id>/profile.ts`):

- `paymentProviders: ["stripe"]` and `payment: STRIPE_PAYMENT`, the
  legal-page wording in `brands/payment-methods.ts`;
- an https `origin` on the brand's apex. Stripe sends the buyer back there,
  and its page shows the brand's branding only on https;
- a final `statementDescriptor`;
- `paymentPage: { logo, icon }`: a PNG or JPG logo and a square icon in
  `public/<id>/`. Without them Stripe's page shows the account's own, which
  are BacLab's. `check:brands` warns until both are set.

## What a buyer can still see of the account

Stripe's page shows the brand's name, colours, logo and icon over the
account's. Per Stripe, the account's own business name "still appears in
terms, receipts, and other places". Receipts are off (step 3), and the
sessions ask for no terms acceptance. On a test-mode session, check that:

- the page names nothing of BacLab's;
- the page is on Stripe's own `checkout.stripe.com`, not a custom
  Checkout domain of BacLab's (*Settings → Custom domains*).

## Running it

- **Refunds:** made in the Stripe Dashboard, as for BacLab's orders.
  Cancelling an order in the admin never refunds it, for any provider. A
  brand's card order shows in the admin exactly as BacLab's do: payment
  "Card", provider "Stripe", the PaymentIntent as its reference, and the
  brand's chip.
- **Abandoned checkouts:** the nightly clear-up asks Stripe about each
  pending brand session as it does BacLab's. An expired one is removed. A
  completed one with no webhook is kept, and logged.
- **What to look for in the logs:**
  - `[stripe] AMOUNT MISMATCH`: what Stripe took for the goods differs from
    the order. It never blocks the order, but investigate it.
  - `[stripe] BRAND MISMATCH`: a session that names another brand than its
    order. A bug in whichever checkout built it.
- **Fees:** Stripe's UK pricing (https://stripe.com/gb/pricing) applies
  per payment, the same as BacLab's. Finance does not record processing
  fees for any provider: "after shipping costs" is not profit.

## Switching a brand to PayPal later

PayPal stays built and tested (`lib/commerce/payments/paypal.ts`,
`npm run test:paypal`), but no brand lists it today. Moving one brand is
config only:

1. Set PayPal up for the brand as below, sandbox first.
2. In its profile, set `paymentProviders: ["paypal"]` and
   `payment: PAYPAL_PAYMENT`. Its legal pages then describe PayPal instead
   of Stripe.
3. Set its four `PAYPAL_*__<ID>` variables and deploy.

Nothing else changes. Its pending Stripe sessions are still cleared up, and
its paid Stripe orders are still refunded in Stripe.

### The PayPal rules

1. **Each brand's PayPal credentials are its own.** There is no shared
   `PAYPAL_CLIENT_ID`, no default environment and no fallback from one brand
   to another. A brand that lists PayPal without all four variables below
   takes no payment: its site still shows the checkout button (it follows
   the profile, as for Stripe above), and the checkout answers *"Checkout
   is not available right now."*
2. **The gym brand never goes on PayPal.**
   - **Why:** PayPal's UK Acceptable Use Policy prohibits, at 2(a),
     *"narcotics, steroids, certain controlled substances or other products
     that present a risk to consumer safety"*. At 2(d) it prohibits *"items
     that encourage, promote, facilitate or instruct others to engage in
     illegal activity"*
     (https://www.paypal.com/uk/legalhub/paypal/acceptableuse-full). The gym
     brand's coded copy is exactly what a PayPal review would read against
     those lines. A freeze would hold every brand on that account, not just
     the gym's.
3. **Declare every site to PayPal.**
   - **What to tell PayPal:** each brand's domain, what it sells (10ml
     bacteriostatic water, sold as a laboratory reagent) and that one company
     runs them all. Do this before the site takes its first payment.
   - **Where:** add the domain in the PayPal business profile's website
     details, and say it in writing to PayPal if they ask.
   - **Why:** as for Stripe, taking payments for a site PayPal has not been
     told about is treated as transaction laundering. The User Agreement
     forbids giving "false, inaccurate or misleading information". The AUP,
     at 3(e), bars collecting payments on behalf of other merchants. (A
     check on 4 Nov 2026 found no clause in the User Agreement or AUP that
     requires a website list in so many words; declare them anyway.)
4. **Neutral words reach PayPal**, never the brand's own voice:
   - item names are "10ml bacteriostatic water × N";
   - the statement descriptor is the profile's `statementDescriptor` (22
     characters at most);
   - the brand appears only as its name on PayPal's page.

### Setting PayPal up for one brand

Do this in the sandbox first, then again in live.

1. **An app per brand.** In the PayPal Developer Dashboard
   (https://developer.paypal.com/dashboard/), under Apps & Credentials, create
   a REST app named after the brand. One app per brand, even on the same
   PayPal business account: each app gets exactly one webhook, on its own
   brand's domain. Two brands on one app would receive each other's events,
   and those would fail verification over and over.
2. **The webhook.**
   - **URL:** add one on the brand's app,
     `https://<brand domain>/api/webhooks/paypal`.
   - **Events:** subscribe to
     - `CHECKOUT.ORDER.APPROVED` (the backup capture for a buyer who closes
       the tab after approving)
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.PENDING`
     - `PAYMENT.CAPTURE.DENIED`
     - `PAYMENT.CAPTURE.REFUNDED`
     - `PAYMENT.CAPTURE.REVERSED`
   - **Webhook ID:** copy it. It is the brand's `PAYPAL_WEBHOOK_ID__<ID>`.
3. **The env vars.** Put them in `/srv/baclab/.env.local`. `<ID>` is the
   brand id in capitals, for example `LUXURY`.

   ```
   PAYPAL_CLIENT_ID__LUXURY=
   PAYPAL_CLIENT_SECRET__LUXURY=
   PAYPAL_WEBHOOK_ID__LUXURY=
   PAYPAL_ENV__LUXURY=sandbox
   ```

   - **All four are required.** `PAYPAL_ENV__<ID>` must be `sandbox` or
     `live`, with no default.
   - **Partly set:** the log names what is missing (`[paypal] luxury: PayPal
     is off until ...`), never the values.
   - **Runtime only:** these are read while the app runs, not as build
     arguments. A restart picks them up, and payments work from the first
     request after it.
   - **The checkout button:** is already there from the profile, whether
     these are set or not. Until all four are, pressing it answers the 503.
4. **The brand's profile** (`brands/<id>/profile.ts`) must have:
   - `paymentProviders: ["paypal"]` and `payment: PAYPAL_PAYMENT`;
   - an https `origin` on the brand's apex, since PayPal sends the buyer back
     there (`/api/payments/paypal/return`);
   - a final `statementDescriptor`.
5. **Test in the sandbox** with a sandbox buyer account:
   - **Pay:** place an order on the brand's site, approve it on PayPal and
     come back. The order confirmation shows it paid. In the admin it shows
     provider PayPal, the capture id as its ref, and the buyer's address.
   - **Webhook backup:** place a second order, approve it, and close the tab
     before returning. Within a minute or two, the `CHECKOUT.ORDER.APPROVED`
     webhook captures it and the order turns paid. The Dashboard's webhook
     events page shows each delivery.
   - **Refund:** refund a payment in the sandbox PayPal account. The
     `PAYMENT.CAPTURE.REFUNDED` notice is added to the order's notes.
6. **Go live:**
   - **Live app:** create the live app and webhook the same way.
   - **Env vars:** swap in the live client id, secret and webhook id, and set
     `PAYPAL_ENV__<ID>=live`.
   - **Last check:** place one real order and refund it.
   - **Environment mismatch:** a sandbox event that reaches a live brand, or
     the other way round, is ignored and logged as an "environment mismatch".

### Running a brand on PayPal

- **Refunds** are made in the brand's own PayPal account. A paid PayPal
  order's admin page says that cancelling does not refund it, and gives the
  transaction id. PayPal's refund or reversal notice is then added to the
  order's notes.
- **Abandoned checkouts:** the nightly clear-up asks PayPal about each
  pending PayPal order, with that brand's credentials, and never asks Stripe.
  - **Gone:** an order PayPal no longer has is removed.
  - **Completed:** one PayPal has completed but we have not is kept, and the
    log says to check the webhook.
  - **Anything else:** kept for PayPal's longest window (72 hours), then
    removed. Money moves only when we capture, so nothing can be taken after
    that.
- **Addresses outside the UK:** PayPal lets the buyer pick any address on
  their account. We read it before capturing, and a non-UK address is never
  captured: the buyer is sent back with a message to choose a UK address.
- **What to look for in the logs:**
  - `[paypal] AMOUNT MISMATCH`: what PayPal captured differs from the order.
    It never blocks the order, but investigate it.
  - `[paypal] environment mismatch`: an event from the wrong environment.
  - `signature verification failed`: an event that did not verify; it is
    never acted on.
  - `no PayPal credentials for <brand>`: a brand with orders but no
    credentials. Its webhooks are answered 500 until the credentials are
    back, so PayPal keeps retrying (up to 25 times over 3 days).
- **Fees:** PayPal UK's standard rate is 2.9% + 30p per payment (PayPal
  business fees page, 1 Oct 2026).

## Adding another provider later

Add its id to `BRAND_PAYMENT_PROVIDERS` (`brands/types.ts`) and an adapter in
`lib/commerce/payments/` with its credentials by brand id, never shared. Give
it a confirmation path that ends in `fulfillPaidOrder`, its words in
`brands/payment-methods.ts`, and tests. Then list it on the brands that use it.
