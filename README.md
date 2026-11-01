# DateMate Consolidated Backend Service

Unified, scalable high-performance real-time backend service for the DateMate platform consolidating Core Platform Services, Real-Time Chat (PostgreSQL + Socket.IO), and Push Notifications (FCM). Built with **Go 1.24+**, Chi router, PostgreSQL (`pgx/v5` + `sqlc`), Redis, Socket.IO (`zishang520/socket.io/v2`), and MinIO/S3 or Local Storage, following Clean Architecture, Domain-Driven Design (DDD), and Modular Monolith principles.

---

## Documentation

- **[Consolidated Backend Architecture & Business Rules Manual](docs/CONSOLIDATED_BACKEND_ARCHITECTURE_AND_BUSINESS_RULES.md)**: Comprehensive guide covering consolidated subdomains, PostgreSQL chat architecture, FCM push notifications, centralized configuration, and troubleshooting runbooks.
- **[Client Rules & Validation Specification (RULES.md)](docs/RULES.md)**: Authoritative rules for media uploads, username, full name, DOB/age, languages, demographics, and security.
  - *Live Online Endpoint*: `http://localhost:3000/docs/rules` (HTML, JSON, raw Markdown, or download).
- **[Swagger OpenAPI Documentation]**: Full interactive REST documentation at `http://localhost:3000/docs` (JSON at `/docs-json` or [datemate-api.json](datemate-api.json)).
- **[Real-Time Chat AsyncAPI Specification]**: Schema specification at `http://localhost:3000/docs/asyncapi-json` with Socket.IO gateway at `ws://localhost:3000/chat` (and `/socket.io`).
- **[Engineering Rules & Guidelines (AGENTS.md)](AGENTS.md)**: SOLID principles, Clean Architecture, and development standards.

---

## Consolidated Subdomains & Portals

1. **Authentication & Identity** (`/v1/auth`, `/v1/users`): Phone OTP authentication, profile management, and active device sessions.
2. **Matching & Discovery** (`/v1/matching`, `/v1/recommended`): Swipe feed, mutual match generation, and candidate discovery.
3. **Social & Friends** (`/v1/friends`): Friend requests, accepts, rejects, and friendship management.
4. **Real-Time Chat & Messaging** (`/v1/conversations`, `/v1/groups`, `/v1/upload`, Socket.IO `/chat` & `/socket.io`):
   - PostgreSQL partitioned timeline tables by day (`YYYYMMDD`).
   - Deterministic 1-on-1 direct conversation UUID generation (`CanonicalPairUtil`).
   - Group chats, invitations, roles (owner, admin, member), and multimedia/voice uploads.
   - Real-time online/offline presence tracking with 3000ms offline debouncing.
5. **Push Notifications** (`/v1/push`, `/v1/notifications/push`):
   - Ultra-low latency asynchronous acceptance (`< 2-3ms`, HTTP 202 Accepted).
   - Bounded in-process worker pool dispatch for internal use cases (matching, friends, chat alerts).
   - Multicast FCM batching (500 tokens/chunk) and mock mode simulation for dev/test environments.
6. **Centralized Configuration** (`internal/config/`):
   - Fully typed, schema-validated settings with sensible defaults for upload limits, chat quotas, pagination limits, and rate limits.

---

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env

# 2. Start backing services (PostgreSQL & Redis)
docker compose up -d postgres redis

# 3. Seed database (geo datasets, questions, interests, test users & admin)
go run ./cmd/seed --all

# 4. Start development server (auto-runs migrations from migrations/ on boot)
go run ./cmd/server

# 5. Run unit and integration tests
go test -v ./...
```

### Full Docker Compose Stack
```bash
# Build and run backend, postgres, redis, and nginx together
docker compose up -d --build
```
