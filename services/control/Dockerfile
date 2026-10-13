# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
RUN corepack enable pnpm
WORKDIR /workspace

FROM base AS pruner
COPY package.json ./
RUN npm install -g "turbo@$(node -p "require('./package.json').devDependencies.turbo")"
COPY . .
RUN turbo prune @peretyn/control --docker

FROM base AS builder
COPY --from=pruner /workspace/out/json/ ./
COPY --from=pruner /workspace/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --config.verify-deps-before-run=false
COPY --from=pruner /workspace/out/full/ ./
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@peretyn/control

FROM base AS prod-deps
COPY --from=pruner /workspace/out/json/ ./
COPY --from=pruner /workspace/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    npm pkg delete scripts.prepare && \
    pnpm install --frozen-lockfile --prod

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/peretyn/peretyn" \
      org.opencontainers.image.version=$VERSION
COPY --from=prod-deps --chown=node:node /workspace/ ./
COPY --from=builder --chown=node:node /workspace/packages/org-roles/dist ./packages/org-roles/dist
COPY --from=builder --chown=node:node /workspace/services/control/dist ./services/control/dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "node services/control/dist/db/push.js && exec node services/control/dist/server.js"]
