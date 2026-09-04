#!/bin/sh
# Container entrypoint for the BacLab storefront.
#
# Two jobs, in order.
#
# 1. TAKE OWNERSHIP OF THE DATA MOUNT. /app/data is a bind mount from the
#    host, and a bind mount arrives with the HOST's numeric ownership — which
#    will not match the container's baclab uid unless you got lucky when the
#    host user was created. Without this the first migration dies with
#    "SQLite database error: unable to open database file". Doing it here
#    rather than documenting a `chown 1001` on the host makes the deploy
#    independent of whatever uid `adduser baclab` happened to hand out.
#
# 2. APPLY MIGRATIONS, then hand off. Migrations run here rather than in the
#    deploy script so the schema is always brought up to date by the same
#    process that is about to serve traffic: a container that starts is a
#    container whose database matches its code. `migrate deploy` applies only
#    COMMITTED migrations — it never generates, resets or drops — which is
#    what makes it safe on every start, including an unattended reboot.
#
# Only this prologue runs as root. The server itself is dropped to baclab.
set -e

APP_USER=baclab
DATA_DIR=/app/data

if [ "$(id -u)" = "0" ]; then
  chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

  echo "[entrypoint] applying database migrations…"
  gosu "$APP_USER" npx prisma migrate deploy

  echo "[entrypoint] starting storefront as $APP_USER"
  exec gosu "$APP_USER" "$@"
fi

# Started with an explicit --user: no privileges to drop, so just run. The
# mount must already be writable by that uid.
echo "[entrypoint] applying database migrations…"
npx prisma migrate deploy

echo "[entrypoint] starting storefront as uid $(id -u)"
exec "$@"
