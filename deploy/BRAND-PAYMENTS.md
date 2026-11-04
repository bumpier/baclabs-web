# Taking payment on the new brands

BacLab takes cards through **Stripe**, on its own checkout, exactly as before.
The four new brands **never use Stripe**: the brand checkout cannot load it (a
test proves no Stripe client is made for any brand host), and BacLab's Stripe
account is BacLab's alone.

The brands take payment through **providers of their own**
(`lib/commerce/payments/`). Today that means **PayPal**, for the beauty, luxury
and wholesale brands. Card processors (Airwallex, Adyen) get an adapter only
once an account is approved.

## The rules

1. **Each brand's PayPal credentials are its own.** There is no shared
   `PAYPAL_CLIENT_ID`, no default environment and no fallback from one brand
   to another. A brand without all four variables below takes no payment: its
   site shows no checkout button and its checkout answers *"Checkout is not
   available right now."*
2. **The gym brand never goes on PayPal**, and never on any account that
   another brand uses. Its checkout stays off until a specialist high-risk
   processor takes it on, with its copy disclosed.
   - **Why:** PayPal's UK Acceptable Use Policy prohibits, at 2(a), *"narcotics,
     steroids, certain controlled substances or other products that present a
     risk to consumer safety"*. At 2(d) it prohibits *"items that encourage,
     promote, facilitate or instruct others to engage in illegal activity"*
     (https://www.paypal.com/uk/legalhub/paypal/acceptableuse-full). The gym
     brand's coded copy is exactly what a PayPal review would read against
     those lines. A freeze would hold every brand on that account, not just
     the gym's.
   - **Enforced in code:** the gym profile lists no provider
     (`paymentProviders: []`). That wins over any credentials, so setting
     `PAYPAL_*__GYM` changes nothing. Do not set them anyway.
3. **Declare every site to PayPal.**
   - **What to tell PayPal:** each brand's domain, what it sells (10ml
     bacteriostatic water, sold as a laboratory reagent) and that one company
     runs them all. Do this before the site takes its first payment.
   - **Where:** add the domain in the PayPal business profile's website
     details, and say it in writing to PayPal if they ask.
   - **Why:** taking payments for a site PayPal has not been told about is
     what processors treat as transaction laundering. The User Agreement
     forbids giving "false, inaccurate or misleading information". The AUP,
     at 3(e), bars collecting payments on behalf of other merchants.
     (A check on 4 Nov 2026 found no clause in the User Agreement or AUP
     that requires a website list in so many words; declare them anyway.)
4. **Neutral words reach PayPal**, never the brand's own voice:
   - item names are "10ml bacteriostatic water × N";
   - the statement descriptor is the profile's `statementDescriptor` (22
     characters at most);
   - the brand appears only as its name on PayPal's page.

## Setting PayPal up for one brand

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
   brand id in capitals: `BEAUTY`, `LUXURY` or `WHOLESALE`.

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
     arguments. A restart picks them up.
   - **The checkout button:** brand pages are prerendered and revalidated
     every 5 minutes, so the button shows once a page has been regenerated
     after the restart.
4. **The brand's profile** (`brands/<id>/profile.ts`) must have:
   - `paymentProviders: ["paypal"]` and `payment: PAYPAL_PAYMENT`, the
     legal-page wording in `brands/payment-methods.ts`;
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

## Running it

- **Refunds** are made in the brand's own PayPal account. Cancelling an order
  in the admin never refunds it, for any provider; a paid PayPal order's page
  says so and gives the transaction id. PayPal's refund or reversal notice is
  then added to the order's notes.
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
  business fees page, 1 Oct 2026). Finance does not record processing fees
  for any provider: "after shipping costs" is not profit.

## Adding another provider later

Add its id to `BRAND_PAYMENT_PROVIDERS` (`brands/types.ts`) and an adapter in
`lib/commerce/payments/` with its credentials by brand id, never shared. Give
it a confirmation path that ends in `fulfillPaidOrder`, its words in
`brands/payment-methods.ts`, and tests. Then list it on the brands that use it.
