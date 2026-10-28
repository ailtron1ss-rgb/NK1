FROM node:24-bookworm-slim

ENV NODE_ENV=development
WORKDIR /workspace

COPY app/package.json app/package-lock.json ./app/
RUN npm ci --prefix ./app --no-audit --no-fund

# Keep the repository layout intact: the app's preflight hydrates byte-verified
# public assets from the canonical runtime tree before Vite starts.
COPY . ./

WORKDIR /workspace/app
EXPOSE 8080

CMD ["npm", "run", "dev"]
