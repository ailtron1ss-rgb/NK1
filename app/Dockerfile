FROM node:24-bookworm-slim AS build

WORKDIR /workspace
ENV NITRO_PRESET=node_server

COPY app/package.json app/package-lock.json ./app/
RUN npm ci --prefix app --no-audit --no-fund

COPY app ./app
COPY runtime ./runtime
COPY contracts ./contracts
COPY .nvmrc ./.nvmrc

# Build the real React/TanStack UI alongside the canonical runtime asset tree.
# Docker uses Nitro's standalone Node server; local/Vercel builds keep the default.
RUN npm run build --prefix app \
    && test -f /workspace/app/.output/server/index.mjs

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    PGLITE_DATA_DIR=/var/lib/neuro-kurisu/app-db

WORKDIR /app
COPY --from=build --chown=node:node /workspace/app/.output ./.output
COPY --from=build --chown=node:node /workspace/app/node_modules ./node_modules

RUN mkdir -p /var/lib/neuro-kurisu/app-db \
    && chown -R node:node /var/lib/neuro-kurisu

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
