# ==========================================
# DateMate Modular Monolith (Go 1.23+)
# Multi-Stage Ultra-Slim Production Image (< 25 MB)
# ==========================================

# Stage 1: Build binary
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /src

# Download dependencies first for fast layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy codebase
COPY . .

# Compile optimized server and seed binaries (or use prebuilt binaries if provided)
RUN if [ -f /src/bin/server ] && [ -f /src/bin/seed ]; then \
        echo "Using prebuilt binaries..."; \
    else \
        CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -trimpath -o /src/bin/server ./cmd/server && \
        CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -trimpath -o /src/bin/seed ./cmd/seed; \
    fi

# Stage 2: Final Minimal Runtime
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binaries from builder
COPY --from=builder /src/bin/server /usr/local/bin/server
COPY --from=builder /src/bin/seed /usr/local/bin/seed

# Copy migrations, reference datasets, icons, and documentation for automated startup
COPY migrations ./migrations
COPY docs ./docs
COPY data ./data
COPY seed-icons ./seed-icons

# Ensure uploads directory exists
RUN mkdir -p /app/uploads

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/server"]
