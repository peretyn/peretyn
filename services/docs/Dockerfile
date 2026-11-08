# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
RUN corepack enable pnpm
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS pruner
COPY package.json ./
RUN npm install -g "turbo@$(node -p "require('./package.json').devDependencies.turbo")"
COPY . .
RUN turbo prune @peretyn/docs --docker

FROM base AS builder
COPY --from=pruner /workspace/out/json/ ./
COPY --from=pruner /workspace/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --config.verify-deps-before-run=false
COPY --from=pruner /workspace/out/full/ ./
COPY tsconfig.base.json ./
COPY api ./api
RUN mkdir -p services/docs/public

ENV NEXT_OUTPUT=standalone

RUN pnpm turbo run build --filter=@peretyn/docs

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/peretyn/peretyn" \
      org.opencontainers.image.version=$VERSION

COPY --from=builder --chown=node:node /workspace/api ./api
COPY --from=builder --chown=node:node /workspace/services/docs/public ./services/docs/public
COPY --from=builder --chown=node:node /workspace/services/docs/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/services/docs/.next/static ./services/docs/.next/static

USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "services/docs/server.js"]
