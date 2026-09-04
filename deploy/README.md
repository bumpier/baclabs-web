# BacLab — deploying onto a shared VPS

BacLab runs as a **second, isolated tenant** on a box that already serves
another storefront. BacLab runs in Docker; the existing app runs from systemd
on the host. They share exactly two things: the host's **nginx** and the host's
**Docker daemon**.

Below, the pre-existing app is written as `<existing>` — substitute its real
service name, user and paths when you run these commands.

## Non-negotiable separation

Break any of these and you take the other site down with you.

| Resource | Existing app | BacLab (this app) |
|---|---|---|
| App directory | `/srv/<existing>` | `/srv/baclab` |
| Process | systemd unit `<existing>` | Docker container `baclab` |
| Loopback port | `127.0.0.1:3000` | `127.0.0.1:3001` (see below) |
| nginx site | `<existing>.conf` | `baclab.conf` |
| nginx upstream | `<existing>_app` | `baclab_app` |
| certbot cert name | `<existing>` | `baclab` |
| Database | `/srv/<existing>/data/<existing>.db` | `/srv/baclab/data/baclab.db` |
| Backups | `/var/backups/<existing>`, `offsite:<existing>-backups/` | `/var/backups/baclab`, `offsite:baclab-backups/` |

**Never run the existing app's deploy scripts for BacLab, or these for it.** In
particular its `add-domain.sh` runs `certbot --cert-name <existing> --expand`,
which would attach a BacLab domain to the other app's certificate and rewrite
its vhost.

> The box is **already provisioned and hardened** for the existing app — ufw, fail2ban,
> unattended-upgrades, nginx, certbot, sqlite3, rclone. Do **not** re-run any
> base-provisioning script: on a live box it is at best redundant and at worst
> locks you out of SSH.

---

## Before you start

- [ ] **The repo pushed.** `baclab-deploy.sh` does `git pull`, so the server
      needs to be able to reach the remote. For a private repo, add a
      read-only deploy key on the server before step 2.
- [ ] **The domain decided and DNS pointed.** `deploy/nginx/baclab.conf` is
      written for `baclab.co.uk` + `www`, inferred from the support address in
      `config/brand.ts`. Confirm or change it, then set A records for apex and
      www to the server's IP and check with `dig +short <domain>`.
- [ ] **Docker Compose v2** available: `docker compose version`.
- [ ] **A free host port.** BacLab defaults to `3001`, but that is a guess about
      YOUR box — other services (a payment gateway, a staging app) often sit
      there. Check before you build:

      ```bash
      sudo ss -tlnp | grep ':3001'      # anything printed = taken
      ```

      If it is taken, set `BACLAB_HOST_PORT=<free port>` in `.env.local` AND
      change the `server 127.0.0.1:<port>` line in
      `deploy/nginx/baclab.conf` to match. They are two files that must agree
      — a mismatch shows up as a 502 from nginx, not as a build error.
- [ ] **The legal pages filled in.** `lib/legal.ts` lists what is still
      outstanding — company details, returns address, VAT statement. Nothing is
      flagged on the pages any more, so that list is the only record.

---

## 1. Create the app user and directory

As root:

```bash
adduser --disabled-password --gecos "" baclab
usermod -aG docker baclab          # so it can run compose without sudo
install -d -o baclab -g baclab /srv/baclab
```

## 2. Clone and configure

As `baclab`:

```bash
git clone <your-remote> /srv/baclab
cd /srv/baclab
mkdir -p data                      # the SQLite bind mount
```

You do **not** need to chown `data/`. A bind mount arrives in the container
with the host's numeric ownership, which will not match the container's app
uid unless you get lucky — so the entrypoint takes ownership of the mount as
root and then drops to the unprivileged `baclab` user via `gosu` before
running anything. That is why the deploy does not care what uid
`adduser baclab` handed out on the host.

Write `/srv/baclab/.env.local`. **`DATABASE_URL` is deliberately absent** —
`docker-compose.yml` sets it, so the container path can never drift from the
mount point.

```bash
cat > /srv/baclab/.env.local <<'EOF'
# Public origin. BUILD-TIME: change it and you must rebuild, not restart.
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_SALE_PREVIEW=false

# Host port for the container. Only needed if 3001 is already in use;
# deploy/nginx/baclab.conf must name the same port.
# BACLAB_HOST_PORT=3001

# Payments
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_SINGLE=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_VALUE=
STRIPE_PRICE_BULK=
STRIPE_PRICE_WHOLESALE=
STRIPE_SHIPPING_RATE_ID=

# Email (Resend — this app does not use the other app's mail stack)
RESEND_API_KEY=
EMAIL_FROM="BacLab <noreply@YOUR_VERIFIED_DOMAIN>"
ORDER_NOTIFY_EMAIL=

# Admin + jobs
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
CRON_SECRET=
EOF
chmod 600 /srv/baclab/.env.local
```

Generate the two secrets and paste them in:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # CRON_SECRET
# ADMIN_PASSWORD: use a password manager, not this.
```

> `EMAIL_FROM` must be on a domain verified in Resend. `lib/email.ts` refuses
> to send while it still contains `example.com` and logs an error saying so.

## 3. Build and start

```bash
cd /srv/baclab
docker compose --env-file .env.local up -d --build
```

`--env-file` is **not optional**: compose substitutes the `NEXT_PUBLIC_*` build
args from it. Without the flag compose reads `.env`, which does not carry those
keys, and every canonical URL, Stripe redirect and email link in the bundle
falls back to the default origin.

Migrations run automatically in the container entrypoint on every start.

Seed the admin user and the product row (once):

```bash
docker compose exec baclab npx prisma db seed
```

Verify the app answers on loopback but not publicly:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001    # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://<VPS_IP>:3001     # expect refused
```

Confirm you have not disturbed the existing app:

```bash
systemctl status <existing> --no-pager | head -3
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000    # expect 200
```

## 4. nginx + TLS

As root:

```bash
cp /srv/baclab/deploy/nginx/baclab.conf /etc/nginx/sites-available/baclab.conf
ln -sf /etc/nginx/sites-available/baclab.conf /etc/nginx/sites-enabled/baclab.conf

sudoedit /etc/nginx/sites-available/baclab.conf   # set the real server_name
nginx -t && systemctl reload nginx

# --cert-name baclab keeps this OFF the other app's certificate. Do not omit it.
certbot --nginx --cert-name baclab --redirect --non-interactive \
  --agree-tos -m YOUR_ADMIN_EMAIL \
  -d YOUR_DOMAIN -d www.YOUR_DOMAIN

nginx -t && systemctl reload nginx
```

Check both certificates still exist and renew independently:

```bash
certbot certificates | grep -E 'Certificate Name|Domains'
```

## 5. Stripe webhook

Point a Stripe webhook endpoint at `https://YOUR_DOMAIN/api/webhooks/stripe`
and put its signing secret in `STRIPE_WEBHOOK_SECRET`. Restart afterwards
(`docker compose --env-file .env.local up -d`). Without it, payments succeed at
Stripe and **no order is ever marked paid**.

## 6. Backups and cron

As `baclab` (`crontab -e`):

```cron
# Nightly backup at 04:00 — offset from the existing app's backup window so
# the two do not contend for disk and rclone bandwidth at the same moment.
0 4 * * * /usr/bin/bash /srv/baclab/deploy/scripts/baclab-backup.sh >> /var/log/baclab-backup.log 2>&1
# Daily repurchase nudges
15 9 * * * curl -fsS -H "Authorization: Bearer $(grep -m1 '^CRON_SECRET=' /srv/baclab/.env.local | cut -d= -f2)" https://YOUR_DOMAIN/api/cron/nudges
```

Verify: `bash /srv/baclab/deploy/scripts/baclab-backup.sh`, then
`rclone ls offsite:baclab-backups/` lists today's two files. Open a copied DB
with `sqlite3 <copy> '.tables'` to prove the snapshot is readable.

## 7. Day two

```bash
# Deploy a code change
bash /srv/baclab/deploy/scripts/baclab-deploy.sh

# Add another storefront domain
sudo ADMIN_EMAIL=you@yourdomain.tld bash /srv/baclab/deploy/scripts/baclab-add-domain.sh newshop.com

# Logs
docker compose -f /srv/baclab/docker-compose.yml logs -f --tail 100 baclab
```

---

## Go-live checklist

- [ ] `https://YOUR_DOMAIN` returns 200 with a valid cert; www redirects to apex.
- [ ] The existing app still returns 200 on its own domains and its service is active.
- [ ] `http://<VPS_IP>:3001` is refused from off-box.
- [ ] A test order reaches Stripe, the webhook fires, and the order shows **paid** in `/admin`.
- [ ] An order confirmation email arrives and passes SPF/DKIM.
- [ ] `baclab-backup.sh` produces a local + offsite copy that opens in sqlite3.
- [ ] `securityheaders.com` shows the app's CSP intact through nginx.
- [ ] The legal pages carry real company details (see `lib/legal.ts`).
