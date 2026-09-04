# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────
# BacLab storefront.
#
# Runs as a SECOND tenant on a VPS that already serves another storefront.
# Everything here is namespaced to baclab and shares nothing with that app
# except the host's nginx and Docker daemon — different image, different
# container, different SQLite file, different host port.
#
# Deliberately NOT using Next.js `output: "standalone"`. Standalone needs
# the Prisma query-engine binary copied by hand into the traced output,
# and a missed engine fails at RUNTIME on the first database query rather
# than at build time. The full-node_modules image is a few hundred MB
# larger and has no such failure mode; on a VPS that is the right trade.
# ─────────────────────────────────────────────────────────────────────

FROM node:20-bookworm-slim AS base
# openssl: Prisma 5 needs it at runtime; the slim image does not ship it.
# gosu:    lets the entrypoint fix bind-mount ownership as root and then drop
#          to the app user. See the entrypoint for why that is necessary.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates gosu \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Build ────────────────────────────────────────────────────────────
FROM base AS builder

# NEXT_PUBLIC_* is INLINED INTO THE CLIENT BUNDLE AT BUILD TIME — it is not
# read from the container environment at runtime. Passing these only through
# env_file would bake lib/site-url.ts's fallback origin into every canonical
# URL, Stripe redirect and email link. They are build args for that reason.
# Change one and you must REBUILD, not just restart.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SALE_PREVIEW
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_GA4_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SALE_PREVIEW=$NEXT_PUBLIC_SALE_PREVIEW \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_GA4_ID=$NEXT_PUBLIC_GA4_ID

# prisma/ before npm ci: the postinstall hook runs `prisma generate`, which
# needs the schema on disk already.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# `next build` instantiates the Prisma client while prerendering, so the URL
# must PARSE. Nothing connects during the build — no route queries at build
# time — and the real value arrives at runtime from .env.local.
ENV DATABASE_URL="file:../data/build-placeholder.db"
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Never serve the storefront as root.
RUN groupadd --system --gid 1001 baclab \
 && useradd  --system --uid 1001 --gid baclab baclab

COPY --from=builder --chown=baclab:baclab /app/node_modules   ./node_modules
COPY --from=builder --chown=baclab:baclab /app/.next          ./.next
COPY --from=builder --chown=baclab:baclab /app/public         ./public
COPY --from=builder --chown=baclab:baclab /app/prisma         ./prisma
COPY --from=builder --chown=baclab:baclab /app/package.json   ./package.json
COPY --from=builder --chown=baclab:baclab /app/next.config.js ./next.config.js

# Operator scripts, and the modules they import. ~200KB of TypeScript, and it
# is the difference between being able to run scripts/stripe-setup.ts against
# the REAL database and not. Running it from a laptop instead would write the
# Product row to the developer's local SQLite file while creating the Prices
# in live Stripe — the two halves landing in different places.
COPY --from=builder --chown=baclab:baclab /app/scripts        ./scripts
COPY --from=builder --chown=baclab:baclab /app/config         ./config
COPY --from=builder --chown=baclab:baclab /app/lib            ./lib
COPY --from=builder --chown=baclab:baclab /app/tsconfig.json  ./tsconfig.json
COPY --chown=baclab:baclab deploy/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# The SQLite file lives on a host bind mount so it survives image rebuilds.
# DATABASE_URL must be ABSOLUTE ("file:/app/data/baclab.db", set in
# docker-compose.yml): a relative path is resolved from the schema directory
# by the Prisma client but from the CWD by the migration engine, so a
# relative URL connects at runtime and fails at migrate time.
RUN install -d -o baclab -g baclab /app/data

# NO `USER baclab` here, deliberately. A bind-mounted host directory keeps its
# host ownership inside the container, so a container that starts as baclab
# cannot chown its own data directory and dies on the first migration with
# "unable to open database file". The entrypoint starts as root, takes
# ownership of the mount, and then drops to baclab via gosu — the same pattern
# the official Postgres image uses. The long-running server is never root.
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
