# Estate Platform API — Cloud Run image.
#
# Debian slim rather than Alpine on purpose: `bcrypt` is a native module and
# ships prebuilt binaries for glibc. On musl it falls back to compiling from
# source, which needs a toolchain in the image and adds minutes to every build.
#
# Two stages so the runtime image carries production dependencies only, but the
# native modules are still compiled against the exact base the runtime uses —
# building bcrypt on one libc and running it on another is a silent failure.

# ---------- build ----------
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Prisma needs OpenSSL to pick its query-engine binary; without it the generated
# client fails at runtime with an unhelpful "unable to detect libssl".
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Dependency layer first, so a source-only change does not reinstall.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts=false

# The Prisma client is generated, not committed — it must exist before the
# runtime stage copies node_modules.
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

# Drop dev dependencies in place, keeping the compiled native modules and the
# generated client that the previous steps put into node_modules.
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Cloud Run injects PORT; this default keeps `docker run` usable on its own.
ENV PORT=8080

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src ./src

# The official image ships an unprivileged `node` user. Running as root in a
# container that accepts uploads is an avoidable escalation path.
USER node

EXPOSE 8080

# Liveness only, matching GET /health — it deliberately does not touch the
# database, so a slow Postgres does not get the container killed and restarted.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# No migrate-on-boot. Several Cloud Run instances start concurrently and would
# race the migration; `prisma migrate deploy` runs as a separate pre-deploy step
# (see docs/DEPLOYMENT.md).
CMD ["node", "src/server.js"]
