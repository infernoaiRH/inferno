# Inferno as one long-running Node server (the relay lives in its memory) with a volume at /data.
# See docs/deploy.md.

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are compiled into the JavaScript, so hosts pass them as build args.
ARG NEXT_PUBLIC_CHAIN
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_SITE_URL
RUN mkdir -p public && npm run build

FROM node:22-slim
WORKDIR /app
# Without DATABASE_URL the ledger is PGlite in /data/ledger, on the volume.
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 INFERNO_DB_PATH=/data/ledger
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Mount a persistent volume at /data. No VOLUME line: Railway rejects it.
RUN mkdir -p /data && chown node:node /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Hosts mount volumes owned by root, so start as root only to hand /data to the node user, then run as node.
CMD ["sh", "-c", "chown -R node:node /data && exec setpriv --reuid=node --regid=node --init-groups node server.js"]
