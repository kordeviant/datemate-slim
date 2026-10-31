# DateMate Consolidated Backend Service

Unified, scalable real-time backend microservice for the DateMate platform consolidating Core Platform Services, Real-Time Chat (Cassandra + Socket.IO), and Push Notifications (FCM). Built with Node.js, NestJS, TypeScript, Socket.IO, PostgreSQL (Prisma), Apache Cassandra, and Redis following Clean Architecture, Domain-Driven Design (DDD), and Modular Monolith principles.

---

## Documentation

- **[Consolidated Backend Architecture & Business Rules Manual](file:///home/kord/datemate/docs/CONSOLIDATED_BACKEND_ARCHITECTURE_AND_BUSINESS_RULES.md)**: Comprehensive guide covering consolidated subdomains, Cassandra chat architecture, FCM push notifications, centralized configuration, and troubleshooting runbooks.
- **[Client Rules & Validation Specification (RULES.md)](file:///home/kord/datemate/docs/RULES.md)**: Authoritative rules for media uploads, username, full name, DOB/age, languages, demographics, and security.
  - *Live Online Endpoint*: `http://localhost:3000/docs/rules` (HTML, JSON, raw Markdown, or download).
- **[Swagger OpenAPI Documentation]**: Full interactive REST documentation at `http://localhost:3000/docs` (JSON at `/docs-json`).
- **[Real-Time Chat AsyncAPI Specification]**: Schema specification at `http://localhost:3000/docs/asyncapi-json` with Socket.IO gateway at `ws://localhost:3000/chat`.
- **[Engineering Rules & Guidelines (AGENTS.md)](file:///home/kord/datemate/AGENTS.md)**: SOLID principles, Clean Architecture, and development standards.

---

## Consolidated Subdomains & Portals

1. **Authentication & Identity** (`/v1/auth`, `/v1/users`): Phone OTP authentication, profile management, and active device sessions.
2. **Matching & Discovery** (`/v1/matching`, `/v1/recommended`): Swipe feed, mutual match generation, and candidate discovery.
3. **Social & Friends** (`/v1/friends`): Friend requests, accepts, rejects, and friendship management.
4. **Real-Time Chat & Messaging** (`/v1/conversations`, `/v1/groups`, `/v1/upload`, Socket.IO `/chat`):
   - Apache Cassandra distributed timeline partitioning by day (`YYYYMMDD`).
   - Deterministic 1-on-1 direct conversation UUID generation (`CanonicalPairUtil`).
   - Group chats, invitations, roles (owner, admin, member), and multimedia/voice uploads.
   - Real-time online/offline presence tracking with 3000ms offline debouncing.
5. **Push Notifications** (`/v1/push`, `/v1/notifications/push`):
   - Ultra-low latency asynchronous acceptance (`< 2-3ms`, HTTP 202 Accepted).
   - In-process direct dispatch for internal use cases (matching, friends, chat alerts).
   - Multicast FCM batching (500 tokens/chunk) and mock mode simulation for dev/test environments.
6. **Centralized Configuration** (`src/config/`):
   - Fully typed, schema-validated settings with sensible defaults for upload limits, chat quotas, pagination limits, and rate limits.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start infrastructure services (PostgreSQL, Redis, Cassandra)
docker compose up -d

# 4. Run database migrations
npx prisma migrate dev

# 5. Start development server
npm run start:dev

# 6. Run unit and integration tests (worker-bounded)
npx jest --maxWorkers=4
```
