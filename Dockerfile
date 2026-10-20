# reflog server + web app in one image.
# Build:  docker compose build      Run: docker compose up -d
# Data lives in the /data volume (SQLite + backups). Nothing secret is baked into the image.

# ---------- build the Svelte web app ----------
FROM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY mobile/package.json mobile/
# Only the root and the web workspace: the Expo app is not needed on the server.
RUN npm ci --include-workspace-root --workspace web --no-audit --no-fund
COPY shared shared
COPY web web
RUN npm run build -w web

# ---------- runtime ----------
FROM node:24-alpine
WORKDIR /app
ARG REFLOG_BUILD=local
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8740 \
    REFLOG_DATA=/data \
    REFLOG_BUILD=$REFLOG_BUILD
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY mobile/package.json mobile/
# Server dependencies only (hono, web-push). The server runs TypeScript directly (Node type stripping).
RUN npm ci --omit=dev --workspaces=false --no-audit --no-fund && npm cache clean --force
COPY shared shared
COPY server server
COPY --from=web /app/web/dist web/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8740
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:8740/api/health >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.ts"]
