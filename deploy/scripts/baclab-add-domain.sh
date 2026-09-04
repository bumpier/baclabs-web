#!/usr/bin/env bash
# Add a BacLab storefront domain (apex + www) to its nginx block and TLS cert.
# DNS for the domain must already point at this server.
#
#   sudo ADMIN_EMAIL=you@yourdomain.tld bash baclab-add-domain.sh example.com
#
# Targets baclab.conf and the certificate named "baclab" ONLY. The other
# app's nginx site and certificate are never read or modified — that
# separation is the whole point of running two certs on one box.
set -euo pipefail

DOMAIN="${1:?usage: baclab-add-domain.sh <domain>}"
: "${ADMIN_EMAIL:?set ADMIN_EMAIL}"
CONF=/etc/nginx/sites-available/baclab.conf
ESC="${DOMAIN//./\\.}"

if [ ! -f "$CONF" ]; then
  echo "FATAL: $CONF not found. Install the BacLab nginx site first." >&2
  exit 1
fi

if grep -qE "([[:space:]]|;|^)${ESC}([[:space:]]|;)" "$CONF"; then
  echo "${DOMAIN} already present; re-running certbot to ensure coverage."
else
  # Insert apex + www into the FIRST server_name line (the :80 block).
  sed -i "0,/server_name /s//server_name ${DOMAIN} www.${DOMAIN} /" "$CONF"
fi

nginx -t
systemctl reload nginx

# --expand adds the new names to the existing "baclab" certificate. The
# --cert-name is what keeps this off the other app's certificate; do not drop it.
certbot --nginx --cert-name baclab --expand --redirect --non-interactive \
  --agree-tos -m "$ADMIN_EMAIL" \
  -d "$DOMAIN" -d "www.$DOMAIN"

nginx -t && systemctl reload nginx
echo "Live: https://${DOMAIN}"
