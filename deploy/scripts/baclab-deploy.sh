#!/usr/bin/env bash
# Update the live BacLab deploy: pull, rebuild the image, restart the container.
#
#   bash /srv/baclab/deploy/scripts/baclab-deploy.sh
#
# Run as a user in the `docker` group. This touches ONLY /srv/baclab and the
# `baclab` container. The other app on this box is a separate systemd service
# and is never read, rebuilt or restarted by this script.
set -euo pipefail

APP_DIR=/srv/baclab
cd "$APP_DIR"

if [ ! -f .env.local ]; then
  echo "FATAL: $APP_DIR/.env.local is missing. The build reads NEXT_PUBLIC_*" >&2
  echo "from it; without it the bundle is built against the wrong origin." >&2
  exit 1
fi

echo "── Pulling ────────────────────────────────────────────"
git pull --ff-only

echo "── Building and restarting ────────────────────────────"
# --env-file is NOT optional: compose substitutes the NEXT_PUBLIC_* build args
# from it. Without the flag compose reads `.env`, which does not carry those
# keys, and every canonical URL, Stripe redirect and email link in the built
# bundle silently falls back to the default origin.
docker compose --env-file .env.local up -d --build

echo "── Waiting for health ─────────────────────────────────"
for _ in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Health.Status}}' baclab 2>/dev/null || echo unknown)"
  case "$status" in
    healthy) echo "healthy"; break ;;
    unhealthy) echo "FATAL: container is unhealthy" >&2; docker compose logs --tail 50 baclab >&2; exit 1 ;;
    *) sleep 5 ;;
  esac
done

docker compose ps

# Old image layers accumulate on every rebuild; on a shared box a full disk
# takes the other site down too. Prune only dangling layers, never tagged images.
docker image prune -f >/dev/null

echo
echo "Deployed. Verify from the box:"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3001"
