# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
RUN corepack enable pnpm
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS pruner
COPY package.json ./
RUN npm install -g "turbo@$(node -p "require('./package.json').devDependencies.turbo")"
COPY . .
RUN turbo prune @peretyn/dashboard --docker

FROM base AS builder
COPY --from=pruner /workspace/out/json/ ./
COPY --from=pruner /workspace/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --config.verify-deps-before-run=false
COPY --from=pruner /workspace/out/full/ ./
COPY tsconfig.base.json ./
RUN mkdir -p services/dashboard/public

ARG PERETYN_CONTROL_URL="http://control:3001"
ENV PERETYN_CONTROL_URL=$PERETYN_CONTROL_URL
ENV NEXT_OUTPUT=standalone

RUN pnpm turbo run build --filter=@peretyn/dashboard

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG PERETYN_CONTROL_URL="http://control:3001"
ENV PERETYN_CONTROL_URL=$PERETYN_CONTROL_URL
ARG VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/peretyn/peretyn" \
      org.opencontainers.image.version=$VERSION

COPY --from=builder --chown=node:node /workspace/services/dashboard/public ./services/dashboard/public
COPY --from=builder --chown=node:node /workspace/services/dashboard/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/services/dashboard/.next/static ./services/dashboard/.next/static

USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "services/dashboard/server.js"]
