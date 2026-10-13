# syntax=docker/dockerfile:1.7

FROM golang:1.26-bookworm AS builder
ENV GOWORK=off
WORKDIR /workspace

COPY services/runtime/go.mod services/runtime/go.sum ./services/runtime/
RUN cd services/runtime && go mod download

COPY services/runtime ./services/runtime
WORKDIR /workspace/services/runtime
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/peretyn-runtime ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
ARG VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/peretyn/peretyn" \
      org.opencontainers.image.version=$VERSION
COPY --from=builder /out/peretyn-runtime /usr/local/bin/peretyn-runtime
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/usr/local/bin/peretyn-runtime"]
