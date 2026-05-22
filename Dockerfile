# syntax=docker/dockerfile:1

FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src

COPY go.mod go.sum ./
COPY deps/minmux ./deps/minmux

# Fallback when deps/minmux is not populated in the build context (e.g. CI without submodule init).
RUN if [ ! -f deps/minmux/router/go.mod ]; then \
      rm -rf deps/minmux && \
      git clone --depth 1 https://github.com/JoakimCarlsson/minmux.git deps/minmux; \
    fi

COPY cmd ./cmd
COPY internal ./internal
COPY web/dist ./web/dist

RUN CGO_ENABLED=0 go build -o /api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /api /api
COPY web/dist /web/dist

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/api"]
