FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    STATE_DIR=/var/lib/neuro-kurisu

WORKDIR /opt/neuro-kurisu

COPY runtime/neuro-kurisu/package.json runtime/neuro-kurisu/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY runtime/neuro-kurisu/src ./src
COPY runtime/neuro-kurisu/public ./public

RUN mkdir -p /var/lib/neuro-kurisu \
    && chown -R node:node /opt/neuro-kurisu /var/lib/neuro-kurisu

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{const d=await r.json();process.exit(r.ok&&d.ready===true?0:1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
