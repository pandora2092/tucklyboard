FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/mini-app/package.json ./apps/mini-app/
COPY packages/contracts/package.json ./packages/contracts/
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

FROM build AS api
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM caddy:2-alpine AS web
COPY infra/production/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/mini-app/dist /srv
