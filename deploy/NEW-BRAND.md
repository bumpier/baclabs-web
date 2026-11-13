# Launching a brand

One brand at a time, from a name to a live site taking orders. Every brand
runs in the same `baclab` container as BacLab, on the same VPS, behind the
same Caddy, and takes cards on BacLab's Stripe account, which
is told about every brand. What it must never share is anything a customer
or a crawler can see: its domain, certificate, mailbox, tracking, statement
wording, payment page and copy are its own, and no page, email, header or
certificate names another brand.

Throughout, `<id>` is the brand's internal id (`luxury`), `<ID>` the same in
capitals (`LUXURY`), `<Name>` its public name, `<apex>` its domain without
`www` (`beautybac.co.uk`) and `<VPS_IP>` the server's address: the one
baclab.co.uk's A record points at in Cloudflare. Never write the IP into the
repo or a public page.

**Where the brand's DNS lives decides its certificate** (step 9):

- **Hostinger's own DNS** (the owner's choice, 13 Nov 2026; BeautyBac is
  set up this way). The domain points straight at the server and Caddy
  fetches its certificate by itself. Nothing hides the server's address:
  every brand set up this way shows the same IP in public DNS, so anyone
  who looks can tell those brands share a server.
- **Cloudflare, proxied.** BacLab's own domain is. The server's address
  stays private and the certificate is one Cloudflare issues. A domain
  bought at Hostinger can still use it, by changing its nameservers.

Who does what:

- **You:** names, accounts, DNS, Resend, Meta, the payment
  processor, every push and deploy.
- **The developer:** the code steps (2 and 6), in a branch, built in a
  scratch copy first.
- **The VPS operator:** steps 7 to 9, on the server.

The four brands already in the code (`beauty`, `gym`, `wholesale`, `luxury`)
skip step 2.

Order matters. A domain must reach the app only once the app knows it: the
app serves BacLab to any host it does not know, and Caddy has nothing to
serve for a name it has no site block for. So the domain is pointed at
the server only after the deploy that teaches the app its name (step 9).

---

## 1. Before any code: names, domain, accounts

None of this needs the developer. Most of it can run in parallel with the
design work.

1. **Name.** Check it on the UK IPO trade mark search
   (https://www.gov.uk/search-for-trademark) in the classes the goods and
   the shop fall in (ask a trade mark attorney which), search the web and
   the marketplaces for anyone trading under it, and check the domain is
   free. The four brands' names were chosen on 6 Nov 2026 (BeautyBac,
   GymWater, BulkBac, LuxeVial; domains `beautybac.co.uk`, `gymwater.co.uk`,
   `bulkbac.co.uk`, `luxevial.co.uk`, unregistered that day, still to buy);
   the trade mark search is still to do.
2. **Domain.** Buy `<apex>` (and the `.com` if you want it parked).
3. **DNS.** In Hostinger's hPanel, *Domains → <apex> → DNS / Nameservers*,
   on Hostinger's own nameservers:
   - **Do not point `<apex>` and `www` at the server yet.** That is step 9.
     Hostinger gives a new domain parking records; leave them for now.
   - **A mailbox.** The addresses the brand publishes (for example
     `hello@<apex>`) must reach an inbox: set up a mailbox or a forwarder
     for each in hPanel's *Emails*, and let it add its MX and SPF records.
   - **DMARC:** add `TXT _dmarc "v=DMARC1; p=none; rua=mailto:<your address>"`.
   - The app sends HSTS with `includeSubDomains; preload` on every host,
     so every subdomain you ever add to the domain must serve HTTPS too.
   - **On Cloudflare instead:** *Add a site* → `<apex>` → Free plan, change
     the nameservers at Hostinger to the two Cloudflare gives, wait for
     *Active*, set *SSL/TLS* to *Full (strict)* and *Always Use HTTPS* on,
     and use *Email → Email Routing* for the mailbox.
4. **Resend.** In Resend, *Domains → Add domain* → `<apex>`, region EU.
   Add exactly the records Resend lists to the domain's DNS zone (on
   Cloudflare: DNS only, never proxied) and press *Verify*. They sit on
   their own names (a DKIM key and a sending subdomain), so they live
   alongside the mailbox's. If the zone already has an SPF record on the
   name Resend asks for, merge the two into one: a name may hold only one.
   The app's existing `RESEND_API_KEY` sends for every verified domain.
5. **Meta.** In Events Manager, create a pixel (dataset) for the brand and a
   Conversions API access token for it. **The gym brand goes in its own
   Business portfolio**, never the one the other brands use, so a
   restriction on it cannot spread. Verify the domain in that portfolio's
   *Brand safety → Domains* by DNS TXT record. Note the pixel id and the token.
6. **Google.** Create a GA4 property if the brand will use one (note its
   `G-…` id). In Search Console add a **Domain** property for `<apex>` and
   verify it with the TXT record it gives you, in the domain's DNS. No code
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
     BRAND-PAYMENTS.md. Statements may start with BacLab's shortened
     descriptor. Stripe's own receipt emails must be off (the owner,
     13 Nov 2026): every site sends its own receipt, in its own look.
   - **A brand on PayPal instead** has an account and credentials of its
     own, declared to PayPal the same way ("Switching a brand to PayPal
     later" in BRAND-PAYMENTS.md).
   - **Images for Stripe's page:** a PNG or JPG logo and a square icon,
     for step 6.
8. **Company details: nothing to collect.** Every brand trades as BacLab
   (the owner, 5 Nov 2026), so its legal pages, footer and contact page
   say "<Brand> is a trading name of BacLab". The profile takes them from
   `brands/operator.ts`, which reads BacLab's own `config/brand.ts`: fill
   a legal name, company number and registered office in there once, and
   all five sites show them.
9. **Packaging.** Every brand ships in the same plain, unprinted box
   (`PLAIN-BOX`, brands/packaging.ts; the owner, 6 Nov 2026), so there is
   nothing to design. What's needed is the real packed weight of every pack
   size (box included, read off a scale). Labels are
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

**Images.** A brand's photographs and other images go in `public/<id>/`
and are served at their site paths (`/images/hero.webp`) on the brand's
host, by the host rewrite in `middleware.ts`.

- **Never next/image's default loader.** It sends every image through
  `/_next/image`, whose optimiser fetches the file from inside the server
  without the brand's `Host`, so the rewrite never runs, the file is not
  found and every image answers 400.
- **Instead:** make the widths the pages need ahead of time with sharp
  (`hero-480.webp` and `hero-960.webp` beside `hero.webp`, say), and give
  next/image a loader that picks the narrowest copy at least as wide as it
  asks for. The width, height, `sizes`, srcset and lazy loading all still
  work. Each brand has one to copy:
  - `brands/beauty/components/Photo.tsx` and `app/wholesale/Photo.tsx`, a
    client component around `<Image>` (the loader is a function, which
    cannot cross from a server component);
  - `brands/luxury/components/photo.ts`, `getImageProps` with the loader on
    the server, for a plain `<img>`;
  - `brands/gym/components/photo.ts`, `getImageProps` with `unoptimized`
    and its own srcset of the copies.
- **The check:** `npm run check:brands` fails any file in a brand's tree
  (and the template) that imports `next/image` and sets neither a `loader`
  nor `unoptimized`.

## 3. Seed its SKUs and weigh them (once the code is deployed)

Every pack is a warehouse kit: N × the shared vial + 1 × the shared plain box
(for example `LUX-10ML-X5` = 5 × `BACLAB-10ML` + 1 × `PLAIN-BOX`). In the
container, after a deploy that contains the brand's catalogue:

```bash
cd /srv/baclab
docker compose exec baclab npx tsx scripts/seed-brand-skus.ts            # dry run: lists what it would create
docker compose exec baclab npx tsx scripts/seed-brand-skus.ts --apply
```

It creates only what is missing, never changes an existing SKU, and warns
about anything that needs a person (a kit that differs from the catalogue,
a missing Lab Kit SKU). Run it again whenever a pack is added.

Then on **/admin/inventory**, enter the real weight and size of `PLAIN-BOX`
(once: every brand shares it) and of every pack kit, from step 1.9. New SKUs start unmeasured, and the
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
   - `email.logo`, the wordmark at the top of every email the brand sends
     (receipts, shipping updates, marketing): a PNG or JPG in
     `public/<id>/`, at least twice the size it is shown at. It should
     read on `colours.header`, the band it sits on;
   - `legalName` and `company` stay `OPERATOR`'s (step 1.8);
   - `shipping.senderCompany` only if the label should name something
     other than the warehouse's company (25 characters at most). Unset is
     what every brand does today;
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
4. **`brands/<id>/catalogue.ts`:** the confirmed prices and packs. The box
   stays `PLAIN_BOX_SKU` unless the brand ships in a box of its own.
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
   mailbox, no legal name, a company number without a registered office,
   no payment provider, no images for Stripe's page, a descriptor too long
   for Stripe's longest prefix, any TODO note left. Run the full test set
   as for any change.
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

On the VPS. Back the database up first when the deploy carries a
migration (the first multi-brand deploy carries two, which the container
applies as it starts):

```bash
cd /srv/baclab
sqlite3 data/baclab.db ".backup 'data/baclab-before-brands.db'"
bash /srv/baclab/deploy/scripts/baclab-deploy.sh
```

A build that fails leaves the old container running. After it is healthy,
check the app now knows the host, straight at the container and before
Caddy is involved. `<PORT>` is the container's port on the box:
`BACLAB_HOST_PORT` in `/srv/baclab/.env.local` (3010 on today's box), or
3001 where it is unset.

```bash
curl -s -H 'Host: <apex>' http://127.0.0.1:<PORT>/ | grep -o '<title>[^<]*</title>'   # the brand's name, not BacLab's
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: <apex>' http://127.0.0.1:<PORT>/admin   # 404
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: baclab.co.uk' http://127.0.0.1:<PORT>/   # 200: BacLab unchanged
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

## 9. DNS, Caddy and the certificate (VPS operator)

The box's web server is Caddy (`/etc/caddy/Caddyfile`), which it shares
with other sites. nginx is installed there and switched off: never start
it. The brand gets **its own site block and its own certificate**.

- **Never add the brand's domain to BacLab's site block**, and never put
  two brands' domains in one block. Caddy fetches one certificate per
  name, so a brand's certificate names nothing but itself; one block for
  two brands would still tie their settings together.
- The app must already know the domain (step 7) before any of this.

### A. The domain on Hostinger's DNS (BeautyBac)

**1. Point the domain at the server.** In hPanel, *Domains → <apex> → DNS /
Nameservers → DNS records*:

- delete the parking records Hostinger made: every `A` and `AAAA` record
  on `@`, and the `CNAME` (or `A`) on `www`. A leftover `AAAA` record sends
  some visitors, and the certificate check, to Hostinger's parking page;
- add `A  @    <VPS_IP>` and `A  www  <VPS_IP>`, TTL 300;
- leave the mail, Resend and verification records as they are.

Wait until both names answer with the server's address, and nothing else:

```bash
dig +short A <apex> @1.1.1.1; dig +short A www.<apex> @1.1.1.1; dig +short AAAA <apex> @1.1.1.1
```

Until the next step the domain answers nothing: Caddy has no site for it.

**2. The site block.** As root, add to the end of `/etc/caddy/Caddyfile`,
leaving every other block as it is:

```
# <Name> (<id>). Its own block; Caddy fetches and renews its certificate.
<apex>, www.<apex> {
	encode zstd gzip
	# Nothing in front of Caddy vouches for this header on this domain.
	request_header -CF-Connecting-IP
	reverse_proxy 127.0.0.1:<PORT>
}
```

- **The certificate:** with no `tls` line, Caddy gets one from Let's
  Encrypt for each name as soon as the block is loaded, and renews it by
  itself. It needs ports 80 and 443 open to the internet, which the other
  sites on the box already use.
- **`request_header -CF-Connecting-IP`:** the app trusts that header for
  the visitor's address (its rate limits use it), because BacLab's domain
  is behind Cloudflare, which sets it. On a domain with nothing in front,
  a visitor could send their own; this line drops it, and the app falls
  back to the address Caddy reports.
- **The host:** Caddy passes the visitor's `Host` to the app unchanged,
  which is how the app picks the brand. Add no `header_up Host`.
- **www:** the app redirects `www.<apex>` to `<apex>` itself.
- **Port 80:** Caddy redirects it to https by itself.
- **Security headers** come from the app (`next.config.js`), not from here.

```bash
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
journalctl -u caddy --since "2 minutes ago" | grep -i -E "certificate obtained|error" | tail
```

A reload that fails leaves Caddy serving the old file, so the other sites
on the box stay up; fix the block and reload again. "certificate obtained
successfully" should show for both names within a minute. If it shows an
error instead, the usual causes are a DNS record that has not spread yet
or a leftover `AAAA` record; fix it and Caddy tries again by itself.

### B. The domain on Cloudflare, proxied

Caddy cannot fetch a certificate behind Cloudflare's proxy, so the brand
uses a Cloudflare Origin CA certificate, as BacLab's own domain does.

- **Create it:** in the brand's Cloudflare zone, *SSL/TLS → Origin
  Server → Create Certificate*, for `<apex>` and `*.<apex>`, RSA, 15 years.
  Copy the certificate and the private key as they are shown: the key is
  shown once.
- **Install it:** on the VPS, as root. Caddy runs as the user `caddy`, so
  the files are readable by the group `caddy` and by nobody else:

  ```bash
  install -d -m 750 -o root -g caddy /etc/ssl/brands
  nano /etc/ssl/brands/<id>.pem     # paste the origin certificate, from -----BEGIN CERTIFICATE-----
  nano /etc/ssl/brands/<id>.key     # paste the private key, from -----BEGIN PRIVATE KEY-----
  chown root:caddy /etc/ssl/brands/<id>.pem /etc/ssl/brands/<id>.key
  chmod 640 /etc/ssl/brands/<id>.pem /etc/ssl/brands/<id>.key
  ```

- **The site block:** as in A, with a `tls` line in place of the
  `request_header` one, and loaded **before** the DNS records exist:

  ```
  <apex>, www.<apex> {
  	tls /etc/ssl/brands/<id>.pem /etc/ssl/brands/<id>.key
  	encode zstd gzip
  	reverse_proxy 127.0.0.1:<PORT>
  }
  ```

- **DNS, last:** in the Cloudflare zone, `A @ <VPS_IP>` and
  `A www <VPS_IP>`, both **proxied** (orange cloud).

### Check it, from your own machine

```bash
curl -sI https://<apex>/ | head -1                      # 200
curl -sI https://www.<apex>/ | grep -i '^location'      # https://<apex>/
curl -s https://<apex>/robots.txt                       # Disallow: / until step 11
curl -s -o /dev/null -w '%{http_code}\n' https://<apex>/admin    # 404
echo | openssl s_client -connect <apex>:443 -servername <apex> 2>/dev/null | openssl x509 -noout -issuer -ext subjectAltName   # the brand's own names only
curl -s https://<apex>/ | grep -o -i -E '<each other brand name, separated by |>' | sort -u   # nothing
curl -sI https://baclab.co.uk/ | head -1                # 200: BacLab unchanged
```

https://crt.sh/?q=<apex> should list the brand's own names and no other
brand's.

**On a box that runs nginx instead** (the first VPS did), the same rules
hold: the brand's own server block, its own certificate, the app's
existing upstream. Never run `deploy/scripts/baclab-add-domain.sh` for a
brand: it adds the domain to BacLab's certificate and server block.

## 10. A live order and a refund

The site is reachable but still noindex. Before anyone else buys:

1. **Order:** place a real order on `https://<apex>` with a real payment.
   The order confirmation page shows it paid.
2. **Email:** the confirmation arrives from the brand's own address, with
   its wordmark at the top (it is fetched from `https://<apex>`, so it
   shows only once the site is reachable). It is the customer's receipt:
   the items, delivery and the total charged. In the message source, SPF
   and DKIM pass for `<apex>`, and nothing in it names BacLab or another
   brand. No receipt arrives from Stripe: its receipt emails are off for
   the account (BRAND-PAYMENTS.md).
3. **Admin:** at baclab.co.uk/admin, the order shows the brand's chip, its
   provider and its reference.
   - **Packing slip:** prints the brand's logo and its thank-you line, and
     no "Pack in" line: the parcel is the shared plain box.
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

- **Take the site offline at once:** change the site block's
  `reverse_proxy` line to `respond 503` and reload Caddy (immediate), or
  delete the domain's `@` and `www` A records (slower: DNS takes time to
  spread). Do one of these **before** any code
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
