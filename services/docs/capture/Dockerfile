FROM node:24-trixie-slim AS node

FROM ghcr.io/charmbracelet/vhs:v0.12.1

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg iproute2 webp \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-compose-plugin iptables \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 --groups docker --shell /bin/bash dev

ENV VHS_NO_SANDBOX=true
VOLUME /var/lib/docker
ENTRYPOINT ["dockerd"]
