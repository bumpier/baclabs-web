#!/usr/bin/env bash
# Nightly BacLab backup: consistent SQLite snapshot + env, rotate, push off-box.
#
# Namespaced away from the other app's backup at every level — different
# source DB, different local directory, different rclone prefix. This script
# reads only /srv/baclab.
#
# Requires an rclone remote named "offsite" and sqlite3 on the host.
set -euo pipefail

APP=/srv/baclab
DEST=/var/backups/baclab
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

# `.backup` takes a CONSISTENT online snapshot — safe to run while the
# container is serving requests. Copying the file with cp would not be: it can
# catch a half-written page and yield a corrupt database that only fails when
# you come to restore it. The DB is a host bind mount, so the host reads the
# same bytes the container writes; no docker exec is needed.
sqlite3 "$APP/data/baclab.db" ".backup '$DEST/baclab-$STAMP.db'"

# The env file holds JWT_SECRET, ADMIN_PASSWORD and the Stripe keys — a
# database restored without it cannot serve or authenticate anyone.
install -m 600 "$APP/.env.local" "$DEST/env-$STAMP.local"

# No uploads archive: this storefront has no public/uploads directory. Product
# imagery is committed to the repo, so the code IS the backup for it. Add a
# tar line here if admin image upload ever starts writing to disk.

# Keep the most recent 14 of each locally.
for pat in 'baclab-*.db' 'env-*.local'; do
  ls -1t "$DEST"/$pat 2>/dev/null | tail -n +15 | xargs -r rm -f
done

# Push off-box. Use an encrypted rclone remote where possible — the env file
# in particular is plaintext secrets at rest.
rclone copy "$DEST/baclab-$STAMP.db"  offsite:baclab-backups/
rclone copy "$DEST/env-$STAMP.local"  offsite:baclab-backups/

echo "Backup complete: baclab-$STAMP.db (local + offsite)"
