# Build and install in the same Debian family as the runtime image so native addons remain ABI-compatible.
FROM node:24-bookworm-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY . .
RUN npm run install:all
RUN npm --prefix app run build

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT=3310 \
    SUPER_GATEWAY_HOST=0.0.0.0 \
    SUPER_GATEWAY_PORT=8080 \
    SUPER_UI_PORT=8081 \
    SUPER_RUNTIME_PORT=3310 \
    SUPER_RESEARCH_PORT=8765 \
    SUPER_STATE_DIR=/data

WORKDIR /opt/nk1
COPY --from=build --chown=node:node /workspace /opt/nk1
RUN mkdir -p /data && chown node:node /data

USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
  CMD ["node", "--input-type=module", "-e", "fetch('http://127.0.0.1:8080/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "tools/super-start.mjs"]
