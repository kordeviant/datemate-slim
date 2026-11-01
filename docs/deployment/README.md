# Deployment & Getting Started Guide

This guide covers local development setup, environment configuration, database seeding, and production deployment for the **DateMate Go Modular Monolith**.

---

## 1. Prerequisites

- **Go**: `v1.24.x` or higher
- **Docker & Docker Compose**: For PostgreSQL, Redis, and Nginx containers
- **Git**: For version control
- **GCC / Musl-dev**: (Only required when compiling Go with `CGO_ENABLED=1` for image processing)

---

## 2. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Key environment variables:
```ini
# Application
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
BASE_URL=http://localhost:3000

# PostgreSQL
DATABASE_URL="postgres://postgres:postgrespassword@localhost:5432/datemate_db?sslmode=disable"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets
JWT_ACCESS_SECRET="your-access-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"

# Media Storage
STORAGE_DRIVER=local
UPLOADS_DIR="./uploads"

# Geographic Data
GEO_DATA_DIR="./data/geo"

# Firebase Cloud Messaging
FCM_MOCK_MODE=true
```

---

## 3. Local Development

### 3.1 Start Backing Services
```bash
docker compose up -d postgres redis
```

### 3.2 Seed Database
Run the integrated Go seeder to populate geography, icons, questions, interest categories, and test/admin users:
```bash
# Run all seeders
go run ./cmd/seed --all

# Or run specific seeders:
go run ./cmd/seed --geo        # Geographic dataset (countries, states, cities)
go run ./cmd/seed --icons      # Profile and interest icons into uploads/
go run ./cmd/seed --questions  # Lifestyle & personality questions
go run ./cmd/seed --interests  # Interest categories and hobbies
go run ./cmd/seed --users      # Test users & admin (admin / admin@datemate.com)
```

### 3.3 Run Development Server
```bash
go run ./cmd/server
```
- The backend automatically executes pending SQL migrations from `migrations/` on boot.
- The HTTP REST API server listens on `http://localhost:3000`.
- Real-time WebSocket (Socket.IO) gateway is active on `ws://localhost:3000/chat` and `ws://localhost:3000/socket.io`.

### 3.4 Run Tests
```bash
# Run all unit and integration tests
go test -v ./...

# Hardware-aware bounded tests (for high-core workstations)
go test -v -p 4 ./...
```

---

## 4. Reverse Proxy & HTTPS (Nginx)

DateMate uses an **Nginx** reverse proxy configured with **HTTPS/TLS**, HTTP-to-HTTPS redirect (301), Gzip compression, and WebSocket (Socket.IO) forwarding.

### 4.1 Generate Local SSL Certificates
For local development and testing, generate a self-signed certificate with SAN (Subject Alternative Name) for `localhost` and `127.0.0.1`:
```bash
cd nginx
./generate-certs.sh
cd ..
```
This generates `nginx/certs/fullchain.pem` and `nginx/certs/privkey.pem`.

### 4.2 Start Nginx
```bash
docker compose up -d nginx
```

Nginx listens on:
- **Port 80 (HTTP)**: Handles ACME challenges and 301 redirects to HTTPS.
- **Port 443 (HTTPS)**: Proxies traffic to DateMate Backend on port 3000 with WebSocket upgrading and rate limiting.

---

## 5. Production Deployment

### 5.1 Docker Compose (Recommended)
The multi-stage `Dockerfile` produces an ultra-slim Alpine container (< 25 MB):
```bash
# Build and start all services (PostgreSQL, Redis, Go Backend, Nginx)
docker compose up -d --build
```

### 5.2 Standalone Binary Compilation
To compile optimized standalone binaries:
```bash
# Build server binary
CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -trimpath -o bin/server ./cmd/server

# Build seed binary
CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -trimpath -o bin/seed ./cmd/seed

# Run server
./bin/server
```

---

## 6. CI/CD Automated Deployment (`.gitlab-ci.yml`)

The repository includes a modern GitLab CI/CD pipeline that automates testing, Docker container builds, and zero-downtime server deployments:

### 6.1 Pipeline Stages
1. **`test` Stage**:
   - Container image: `golang:1.24-alpine`
   - Executes `go vet ./...`
   - Executes `go test -v -p 4 ./...`
   - Validates build output: `go build ./cmd/server` and `go build ./cmd/seed`

2. **`deploy` Stage (on `main` and `develop` branches)**:
   - Connects to production host via SSH using `$SSH_PRIVATE_KEY`.
   - Fetches and resets repository to latest remote commit.
   - Updates `.env` configuration from CI variable `$ENV_FILE_CONTENT`.
   - Starts database and cache services: `docker compose up -d postgres redis`.
   - Waits for PostgreSQL readiness check (`pg_isready`).
   - Builds and launches backend container with automatic zero-downtime container replacement: `docker compose up -d --build --remove-orphans backend nginx`.
   - Reloads Nginx reverse proxy configuration (`docker exec datemate_nginx nginx -s reload`).

### 6.2 Required CI/CD Variables
In GitLab (Settings > CI/CD > Variables):
- `SERVER_IP`: Target host IP address.
- `SERVER_USER`: SSH username.
- `SSH_PRIVATE_KEY`: Private SSH key for server access.
- `SSH_PORT`: (Optional, defaults to `22`).
- `DEPLOY_DIR`: Target deployment directory on the server (e.g. `~/backend`).
- `ENV_FILE_CONTENT`: Complete production `.env` file contents.

### 6.3 Database Migrations Policy
Migrations are automatically applied on server boot via `database.RunMigrations` (`migrations/*.up.sql`). When new migrations are added to `migrations/`, deploying the new container immediately and safely migrates the database during container startup before accepting traffic.
