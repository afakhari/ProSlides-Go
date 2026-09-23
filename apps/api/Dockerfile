ARG BASE_REGISTRY=docker.io/library

FROM ${BASE_REGISTRY}/golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/proslides-api ./cmd/api

FROM ${BASE_REGISTRY}/alpine:3.21
RUN apk add --no-cache ca-certificates \
    && addgroup -S proslides \
    && adduser -S -G proslides proslides
WORKDIR /app
COPY --from=build --chown=proslides:proslides /out/proslides-api /app/proslides-api

EXPOSE 8080
USER proslides:proslides
ENTRYPOINT ["/app/proslides-api"]
