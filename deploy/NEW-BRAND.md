# Launching a brand

One brand at a time, from a name to a live site taking orders. Every brand
runs in the same `baclab` container as BacLab, on the same VPS, behind the
same nginx and Cloudflare, and takes cards on BacLab's Stripe account, which
is told about every brand. What it must never share is anything a customer
or a crawler can see: its domain, certificate, mailbox, tracking, statement
wording, payment page and copy are its own, and no page, email, header or
certificate names another brand.

Throughout, `<id>` is the brand's internal id (`luxury`), `<ID>` the same in
capitals (`LUXURY`), `<Name>` its public name, `<apex>` its domain without
`www` (`reserve10.co.uk`) and `<VPS_IP>` the server's address: the one
baclab.co.uk's A record points at in Cloudflare. Never write the IP into the
repo or a public page; Cloudflare's proxy is what keeps it private.

Who does what:

- **You:** names, accounts, Cloudflare, Resend, Meta, the payment
  processor, every push and deploy.
- **The developer:** the code steps (2 and 6), in a branch, built in a
  scratch copy first.
- **The VPS operator:** steps 7 to 9, on the server.

The four brands already in the code (`beauty`, `gym`, `wholesale`, `luxury`)
skip step 2.

Order matters. A domain must reach the app only once the app knows it: the
app serves BacLab to any host it does not know, and nginx serves its
default site to any name it has no server block for. So DNS records for the
site come last, after the deploy and the nginx block (step 9).

---

## 1. Before any code: names, domain, accounts

None of this needs the developer. Most of it can run in parallel with the
design work.

1. **Name.** Check it on the UK IPO trade mark search
   (https://www.gov.uk/search-for-trademark) in the classes the goods and
   the shop fall in (ask a trade mark attorney which), search the web and
   the marketplaces for anyone trading under it, and check the domain is
   free. The working names in the code (Aurelle, Brute Lab, Vialhouse,
   Reserve No.10) are placeholders until this is done.
2. **Domain.** Buy `<apex>` (and the `.com` if you want it parked).
3. **Cloudflare zone.** In Cloudflare, *Add a site* → `<apex>` → Free plan.
   Change the nameservers at the registrar to the two Cloudflare gives you,
   and wait until the zone shows *Active*. Then, in the zone:
   - **Do not add the A records for `<apex>` and `www` yet.** They are step 9.
   - **SSL/TLS → Overview:** *Full (strict)*.
   - **SSL/TLS → Edge Certificates:** *Always Use HTTPS* on. The app sends
     HSTS with `includeSubDomains; preload` on every host, so every
     subdomain you ever add to this zone must serve HTTPS too.
   - **Email → Email Routing:** enable it, add the addresses the brand will
     publish (for example `hello@<apex>` and `contact@<apex>`) and forward
     them to your inbox. Let Cloudflare add its MX and SPF records.
   - **DNS:** add a DMARC record: `TXT _dmarc "v=DMARC1; p=none; rua=mailto:<your address>"`.
4. **Resend.** In Resend, *Domains → Add domain* → `<apex>`, region EU.
   Add exactly the records Resend lists to the Cloudflare zone (DNS only,
   never proxied) and press *Verify*. They sit on their own names (a DKIM
   key and a sending subdomain), so they live alongside Email Routing's.
   The app's existing `RESEND_API_KEY` sends for every verified domain.
5. **Meta.** In Events Manager, create a pixel (dataset) for the brand and a
   Conversions API access token for it. **The gym brand goes in its own
   Business portfolio**, never the one the other brands use, so a
   restriction on it cannot spread. Verify the domain in that portfolio's
   *Brand safety → Domains* by DNS TXT record. Note the pixel id and the token.
6. **Google.** Create a GA4 property if the brand will use one (note its
   `G-…` id). In Search Console add a **Domain** property for `<apex>` and
   verify it with the TXT record it gives you, in Cloudflare DNS. No code
   or deploy is needed for that.
7. **Payment.** The brand takes cards through Stripe, on BacLab's own
   Stripe account, with no key or account of its own
   ([BRAND-PAYMENTS.md](BRAND-PAYMENTS.md)). **Declare the site to Stripe
   before it takes a single payment**:
   - **What to declare:** the domain, what it sells (10ml bacteriostatic
     water, sold as a laboratory reagent), and that one company runs it,
     BacLab and the other brands.
   - **Why:** taking card payments for a website the processor has not been
     told about is what the card schemes' rules treat as transaction
     laundering. It can end with the account closed (BacLab's with it) and
     the company listed so that no other processor will take it on.
   - **Then:** keep Stripe's written confirmation with the brand's records.
   - **The first brand only:** the account's one-off settings in
     BRAND-PAYMENTS.md (a neutral shortened descriptor, Stripe's receipt
     emails off).
   - **A brand on PayPal instead** has an account and credentials of its
     own, declared to PayPal the same way ("Switching a brand to PayPal
     later" in BRAND-PAYMENTS.md).
   - **Images for Stripe's page:** a PNG or JPG logo and a square icon,
     for step 6.
8. **Company details.** The legal name, company number and registered
   office the brand's legal pages must show (Trading Disclosures
   Regulations 2008). One company runs every brand, so they are normally
   the same on each.
9. **Packaging.** The brand's box or insert, and the real packed weight of
   every pack size in it (box included, read off a scale). Labels are
   bought by weight, so a guessed weight buys the wrong service.
   - **Wholesale only:** packs of 250 vials and up weigh over 2 kg, the
     limit of today's Royal Mail and Amazon services. Add a heavier
     SmartTrack service on `/admin/shipping` before those packs go on sale.

## 2. Make the brand in the code (developer, a new brand only)

From the repo root, on a branch:

```bash
npm run new-brand -- <id> --name "<Name>" --domain <apex>            # dry run: prints every file and edit
npm run new-brand -- <id> --name "<Name>" --domain <apex> --apply    # writes them
npx tsc --noEmit && npm run check:brands && npm run test:hosts && npm run test:brands
```

- **The id:** lower-case letters and digits only. No hyphen, because the id
  goes into env names. The script refuses an id that is already a brand, a
  route or a file of BacLab's, and a name, domain, short code
  (`--short XY`) or SKU stem (`--sku STEM`) that another brand uses.
- **What it makes:** `brands/<id>/` (profile, catalogue, stylesheet),
  `app/<id>/` (the site) and `public/<id>/icon.svg`, all copied from
  `brands/_template/`.
- **Where it registers the brand:** `BRAND_IDS`, the registry,
  `brands/hosts.json` (`<id>.localhost` only), the two matcher literals in
  `middleware.ts`, `app/globals.css` and the copy-rule layers.
- **Not live:** the brand starts with `LIVE = false`, no payment provider
  and no mailing list, so its site shows no checkout and is noindex.
- **Its copy rules:** set its own banned words in `lib/content-rules.ts`
  `BRAND_LAYERS.<id>`. It starts with rules 1 and 2 only.
- **Try it:** `npm run dev`, then open `http://<id>.localhost:3000`.

Then the brand's design and copy go into `brands/<id>/` and `app/<id>/`. That
is design work, not this runbook.

## 3. Seed its SKUs and weigh them (once the code is deployed)

Every pack is a warehouse kit: N × the shared vial + 1 × the brand's box
(for example `LUX-10ML-X5` = 5 × `BACLAB-10ML` + 1 × `LUX-BOX`). In the
container, after a deploy that contains the brand's catalogue:

```bash
cd /srv/baclab
docker compose exec baclab npx tsx scripts/seed-brand-skus.ts            # dry run: lists what it would create
docker compose exec baclab npx tsx scripts/seed-brand-skus.ts --apply
```

It creates only what is missing, never changes an existing SKU, and warns
about anything that needs a person (a kit that differs from the catalogue,
a missing Lab Kit SKU). Run it again whenever a pack is added.

Then on **/admin/inventory**, enter the real weight and size of the box SKU
and of every pack kit, from step 1.9. New SKUs start unmeasured, and the
label buyer treats unmeasured as "not known".

## 4. Analytics and payment settings

- **Profile (code, step 6):**
  - `analytics.metaPixelId`: the brand's pixel id;
  - `analytics.ga4Id`: its GA4 id, or leave it unset.
- **Env (VPS, step 8):** `META_CAPI_ACCESS_TOKEN__<ID>`, the brand's own
  Conversions API token. Without it, the brand's server events fall back to
  the shared `META_CAPI_ACCESS_TOKEN`, which is the wrong account for a brand.
- **Payments:** on Stripe there is no env for the brand: it uses BacLab's
  Stripe settings. Its profile fields are in
  [BRAND-PAYMENTS.md](BRAND-PAYMENTS.md). A brand on PayPal has its own
  `PAYPAL_*__<ID>`, with no fallback to another brand's.

## 5. The env vars, in one place

Add to `/srv/baclab/.env.local` on the VPS, and nothing else changes for
BacLab or the other brands:

```
META_CAPI_ACCESS_TOKEN__<ID>=
# Nothing for Stripe: the brand uses BacLab's Stripe settings.
# A brand on PayPal instead: its four PAYPAL_*__<ID>, see BRAND-PAYMENTS.md.
```

`CONTACT_FORM_TO`, if set, sends every brand's contact-form messages to one
inbox. Leave it unset to send each brand's to its own `email.inbox`.

## 6. The launch commit (developer)

One commit, on a branch, with the real values in place of every
placeholder:

1. **`brands/hosts.json`:** add the apex and www to the brand's entry, and
   keep its development host:

   ```json
   "<id>": ["<id>.localhost", "<apex>", "www.<apex>"]
   ```

   `www.<apex>` then redirects to `<apex>` by itself (`next.config.js`).
2. **`middleware.ts`:** the host matcher literal must match hosts.json
   exactly. Print it and paste it over the `value:` of the host-conditioned
   entry:

   ```bash
   npx tsx -e 'import { brandHostPattern } from "./lib/brand/resolve"; console.log(JSON.stringify(brandHostPattern()));'
   ```

3. **`brands/<id>/profile.ts`:**
   - `origin: "https://<apex>"`;
   - `email.from` on `<apex>`, plus `contact` and `inbox` (the Email
     Routing addresses from step 1.3);
   - `legalName` and `company` from step 1.8;
   - `shipping.senderCompany`, the label's sender name (25 characters at
     most);
   - `statementDescriptor`: letters, digits, spaces, `.` and `-` only.
     Stripe prints it after the account's shortened descriptor
     (`<prefix>* <descriptor>`, 22 characters in all). Ten characters fit
     after any prefix Stripe allows; `check:brands` holds a longer one to
     the prefix recorded in `STRIPE_STATEMENT_PREFIX`;
   - `paymentProviders: ["stripe"]` and `payment: STRIPE_PAYMENT`, as
     BRAND-PAYMENTS.md says, once the site is declared to Stripe (step 1.7);
   - `paymentPage: { logo, icon }`, the PNG or JPG images from step 1.7, in
     `public/<id>/`;
   - `analytics`, from step 4;
   - `mailingList.consentText` if the brand runs a list, in exactly the
     words its signup form shows.
4. **`brands/<id>/catalogue.ts`:** the confirmed prices, box SKU and packs.
5. **`app/<id>/site.ts`:** the real `DESCRIPTION`. Leave `LIVE = false`;
   that is step 11.
6. Delete every `TODO(launch)` and `TODO(confirm)` note you have resolved.
7. **Check it**, and fix until it passes:

   ```bash
   npx tsc --noEmit
   npm run check:brands -- --launch <id>     # must end "✓ <id>: ready for launch"
   npm run test:hosts && npm run test:brands && npm run test:kit && npm run test:brand-checkout
   ```

   `--launch` turns every "not ready for launch" warning for that brand
   into a failure: a development origin or host, a placeholder or missing
   mailbox, missing company details, no label sender, no payment provider,
   no images for Stripe's page, the account's shortened descriptor not yet
   recorded in `STRIPE_STATEMENT_PREFIX`, any TODO note left. Run the full
   test set as for any change.
8. **Build it in a scratch copy**, as for every change (never in the repo,
   where another session's dev server shares `.next`):

   ```bash
   rsync -a --exclude node_modules --exclude .next --exclude .git ./ /tmp/brand-build/
   ln -s "$PWD/node_modules" /tmp/brand-build/node_modules
   cd /tmp/brand-build && DATABASE_URL="file:../data/build-placeholder.db" NEXT_PUBLIC_SITE_URL=https://baclab.co.uk npx next build
   ```

   (The same placeholder database the Dockerfile builds with: `next build`
   instantiates the Prisma client while prerendering.)

   The brand's pages must show as prerendered (`○`) in the route table, as
   the other brands' do.

You push the branch and merge it. Nothing is reachable on the domain yet,
because it has no DNS records.

## 7. Deploy (you)

On the VPS, as the `baclab` user:

```bash
bash /srv/baclab/deploy/scripts/baclab-deploy.sh
```

A build that fails leaves the old container running. After it is healthy,
check the app now knows the host, straight at the container and before
nginx is involved:

```bash
curl -s -H 'Host: <apex>' http://127.0.0.1:3001/ | grep -o '<title>[^<]*</title>'   # the brand's name, not BacLab's
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: <apex>' http://127.0.0.1:3001/admin   # 404
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: baclab.co.uk' http://127.0.0.1:3001/   # 200: BacLab unchanged
```

Then seed the SKUs and weigh them (step 3).

## 8. Env vars on the VPS

Add the brand's lines from step 5 to `/srv/baclab/.env.local`, then
recreate the container so it reads them:

```bash
cd /srv/baclab
docker compose --env-file .env.local up -d
docker compose logs --tail 50 baclab
```

`docker compose restart` does not re-read the env file; `up -d` does. The
log names any payment provider whose credentials are only partly set,
never their values. The checkout button does not wait for any of this: it
follows the profile's `paymentProviders`, so it is on every brand page from
the deploy on, prerendered by a build that never sees the env. Until the
provider is configured, pressing it answers "Checkout is not available
right now." A brand on Stripe needs no env of its own: it takes payment
while BacLab's cards are on.

## 9. nginx, the certificate, then DNS (VPS operator)

The brand gets **its own nginx server block and its own certificate**.

- **Never run `deploy/scripts/baclab-add-domain.sh` for a brand.** It
  adds the domain to the `baclab` certificate with `--expand`, which would
  publish every brand's domain on one certificate (certificate logs, such
  as crt.sh, are public), and it adds the domain to BacLab's server block.
- **Never add a second `upstream` for `127.0.0.1:3001`.** The brand's
  block proxies to `baclab_app`, the upstream that `baclab.conf` already
  defines.

**The certificate: a Cloudflare Origin CA certificate (recommended).**

- **Why:** it is not published in the certificate logs, needs no
  challenge, and lasts 15 years. It is trusted only by Cloudflare, so the
  domain must stay proxied, which it must anyway.
- **Create it:** in the brand's Cloudflare zone, *SSL/TLS → Origin
  Server → Create Certificate*, for `<apex>` and `*.<apex>`, RSA, 15 years.
- **Install it:** on the VPS, as root:

  ```bash
  install -d -m 700 /etc/ssl/brands
  sudoedit /etc/ssl/brands/<id>.pem     # paste the origin certificate
  sudoedit /etc/ssl/brands/<id>.key     # paste the private key
  chmod 600 /etc/ssl/brands/<id>.key
  ```

**Or Let's Encrypt, with its own cert name.**

- **How:** use the DNS challenge through Cloudflare's API:
  `certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare-<id>.ini --cert-name <id> -d <apex> -d www.<apex>`.
  This needs the `python3-certbot-dns-cloudflare` package and an API token
  limited to that zone's DNS. Point the two `ssl_` lines below at
  `/etc/letsencrypt/live/<id>/`.
- **Never** take the zone off Cloudflare's proxy to pass an HTTP
  challenge: for those minutes the records show the server's IP, which is
  every brand's IP, and DNS history sites keep it.

**The server block.** As root, write `/etc/nginx/sites-available/<id>.conf`:

```nginx
# <Name> (<id>). Its own server block and certificate; the upstream is
# baclab_app from baclab.conf, the same container as every brand.
server {
    listen 80;
    listen [::]:80;
    server_name <apex> www.<apex>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name <apex> www.<apex>;

    ssl_certificate     /etc/ssl/brands/<id>.pem;
    ssl_certificate_key /etc/ssl/brands/<id>.key;

    client_max_body_size 1m;

    location / {
        proxy_pass http://baclab_app;
        proxy_http_version 1.1;
        # The app picks the brand from Host. It must be the visitor's host.
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 300s;
    }

    # Security headers come from the app (next.config.js), not from here.
}
```

Enable it and check, still before any DNS record exists:

```bash
ln -sf /etc/nginx/sites-available/<id>.conf /etc/nginx/sites-enabled/<id>.conf
nginx -t && systemctl reload nginx
curl -sk --resolve <apex>:443:127.0.0.1 https://<apex>/robots.txt          # the brand's robots.txt
curl -sk -o /dev/null -w '%{http_code}\n' --resolve <apex>:443:127.0.0.1 https://<apex>/admin   # 404
certbot certificates | grep -E 'Certificate Name|Domains'                  # baclab's cert still lists only BacLab's names
```

**DNS, last.** In the brand's Cloudflare zone add, both **proxied** (orange
cloud):

- `A  @    <VPS_IP>`
- `A  www  <VPS_IP>`

Then, from your own machine:

```bash
curl -sI https://<apex>/ | head -1                      # 200
curl -sI https://www.<apex>/ | grep -i '^location'      # https://<apex>/
curl -s https://<apex>/robots.txt                       # Disallow: / until step 11
curl -s -o /dev/null -w '%{http_code}\n' https://<apex>/admin    # 404
echo | openssl s_client -connect <apex>:443 -servername <apex> 2>/dev/null | openssl x509 -noout -ext subjectAltName   # this zone's names only
curl -s https://<apex>/ | grep -o -i -E 'baclab|<each other brand name, separated by |>' | sort -u   # nothing
curl -sI https://baclab.co.uk/ | head -1                # 200: BacLab unchanged
```

Check https://crt.sh/?q=<apex> lists only the brand's own names. With an
Origin CA certificate it lists only Cloudflare's edge certificate for the
zone.

## 10. A live order and a refund

The site is reachable but still noindex. Before anyone else buys:

1. **Order:** place a real order on `https://<apex>` with a real payment.
   The order confirmation page shows it paid.
2. **Email:** the confirmation arrives from the brand's own address. In
   the message source, SPF and DKIM pass for `<apex>`, and nothing in it
   names BacLab or another brand. No receipt arrives from Stripe: its
   receipt emails are off for the account (BRAND-PAYMENTS.md).
3. **Admin:** at baclab.co.uk/admin, the order shows the brand's chip, its
   provider and its reference.
   - **Packing slip:** prints the brand's logo, its thank-you line and
     "Pack in: <the brand's box>".
   - **Label:** has the brand's sender name and is bought at the pack's
     real weight.
4. **Meta:** Events Manager shows the Purchase in the brand's own dataset,
   once, with the value charged.
5. **Stripe's page:** it showed the brand's name, logo and icon, on
   `checkout.stripe.com`, and nothing of BacLab's; the statement line reads
   `<prefix>* <statementDescriptor>`.
6. **Refund:** refund the payment in the Stripe Dashboard (or, for a brand
   on PayPal, its own PayPal account), as BRAND-PAYMENTS.md describes. Then
   cancel the order in the admin so it is not packed. The admin never
   refunds by itself.

## 11. Go live

1. **Flip LIVE (developer):** set `LIVE = true` in `app/<id>/site.ts`. From
   then on `check:brands` always holds the brand to the launch rules, with
   or without `--launch`.
   ```bash
   npm run check:brands -- --launch <id>
   ```
2. **Deploy (you):** commit, push and deploy as in step 7. `robots.txt`
   now allows crawling and the pages are indexable.
3. **Search Console:** in the Domain property from step 1.6, submit
   `https://<apex>/sitemap.xml`.
4. **Trustpilot**, only if wanted: give the brand its own Automatic
   Feedback Service address in `reviews.inviteBcc` (never another
   brand's), in a later deploy.

There are no new cron lines or backups: the shared cron and the nightly
backup already cover every brand's orders.

## Rollback

- **Take the site offline at once:** in the brand's Cloudflare zone, delete
  the `@` and `www` A records, or change the server block's `location /` to
  `return 503;` and reload nginx. Do one of these **before** any code
  rollback. A domain the app no longer knows is served BacLab's site, which
  is the one thing that must never happen.
- **Stop taking payment, nothing else:** set the brand's
  `paymentProviders` to `[]` and deploy. Its site then shows no checkout
  button, and its checkout answers "Checkout is not available right now".
  No other brand is touched. Never remove BacLab's Stripe keys for this:
  every brand and BacLab would stop with them. (A brand on PayPal can also
  be stopped by removing its `PAYPAL_*__<ID>` and running
  `docker compose --env-file .env.local up -d`; its button then stays, and
  answers with that sentence.)
- **Back to noindex:** set `LIVE = false` and deploy.
- **Unregister the domain:** once the site is offline, remove the apex and
  www from `brands/hosts.json` and the middleware literal, set the origin
  back to the development host, and deploy.
- **A bad deploy:** a failed build never replaces the running container.
  For a deployed commit that misbehaves, revert it, push and deploy again.
