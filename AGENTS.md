# DateMate Backend Architecture & Engineering Guidelines

> **Audience**: Backend Engineers and Autonomous AI Agents (Antigravity, Cursor, Claude Code, Copilot, Windsurf).  
> **Mission**: Build, refactor, and maintain DateMate's high-performance modular monolith backend with sub-millisecond execution discipline, strict domain invariants, and automated delivery.

---

## 1. Architectural Constitution & Core Principles

### 1.1 Clean Architecture + DDD + Modular Monolith
- **Modular Monolith**: Code is strictly partitioned by bounded contexts / business domains (`internal/modules/auth`, `users`, `matching`, `chat`, `friends`, `recommended`, `media`, `admin`, `system`).
- **Domain-Driven Design (DDD)**: Keep pure domain models, business logic, and invariants isolated in domain services (`internal/modules/<domain>/service.go`). Keep infrastructure drivers strictly isolated in `internal/platform/`.
- **Core Benefits**:
  - Low coupling & high cohesion across modules.
  - Effortless unit and integration testing with deterministic mocks.
  - Easy feature addition without unintended side effects.
  - Zero architectural friction to split into independent microservices if traffic demands.

### 1.2 SOLID Principles
- **S (Single Responsibility)**: Keep HTTP Controllers/Handlers, Domain Services, and Data Repositories strictly separated.
- **O (Open/Closed)**: Use Go interfaces and strategy patterns for easy extension without mutating existing stable code.
- **L (Liskov Substitution)**: All implementations must strictly honor their interface contracts.
- **I (Interface Segregation)**: Design small, focused, granular interfaces rather than monolithic god-interfaces.
- **D (Dependency Inversion)**: Always depend on abstractions and interfaces; inject dependencies at initialization (`cmd/server/main.go`). Never instantiate databases, caches, or external clients directly inside business logic.

### 1.3 Extensibility & Ease of Change
- Design every module so adding or modifying a feature requires minimal friction and zero breaking changes to existing components.
- Keep business logic completely decoupled from infrastructure drivers (PostgreSQL/pgx/sqlc, Redis, Socket.IO, HTTP Chi router, Firebase, Mailer).
- Use strictly typed DTOs, domain events, and modular services to enforce loose coupling.

### 1.4 Mandatory Testing & Quality Gate
- **Test-Driven / Verified**: Always add or update unit and integration tests whenever adding a new feature or modifying an existing one.
- Every use case must have corresponding test coverage to prevent regressions and verify edge cases.
- **Worker Bound `-p 4` is Mandatory**: On 20-core hosts, always execute `go test -p 4 ./...` to prevent memory exhaustion and OOM crashes.

### 1.5 Living Documentation
- Whenever code, APIs, schemas, or business logic change, immediately update the relevant documentation (`CLIENT_DEV_GUIDE.md`, `docs/RULES.md`, `ARCHITECTURE.md`, `asyncapi.json`, and Swagger specs) to stay 100% in sync.

---

## 2. Fast Command Cheatsheet

| Task | Command | Constraints & Invariants |
|:---|:---|:---|
| **Run All Tests** | `go test -p 4 ./...` | **Worker bound `-p 4` is mandatory** on 20-core host |
| **Run Targeted Test** | `go test -p 4 -v ./test/ -run "TestName"` | Fast single-test feedback loop |
| **Generate SQLC Code** | `sqlc generate` | Recompiles type-safe DB querier and models |
| **Run Server Locally** | `go run ./cmd/server` | Chi HTTP router + Socket.IO on port 3000 |
| **Run Database Seeder** | `go run ./cmd/seed --all` | Seeds reference geo, questions, interests, test users |
| **Compile Binary** | `CGO_ENABLED=1 go build -ldflags="-s -w" -o bin/server ./cmd/server` | Multi-stage slim CGO build |
| **Sync Staging Code** | `rsync -avz --exclude '.git' --exclude 'uploads' --exclude 'bin' ./ datemate:/var/develop/` | Syncs workspace to staging server |
| **Apply Staging Migration**| `ssh datemate "docker exec -i datemate_dev_postgres psql -U postgres -d datemate_db < /var/develop/migrations/<file>.up.sql"` | Runs migration on staging DB |
| **Rebuild Staging Backend**| `ssh datemate "cd /var/develop && docker compose -p datemate_dev build backend && docker compose -p datemate_dev up -d backend"` | Recreates staging backend container |

---

## 3. Architecture & Codebase Map

| Subsystem / Path | Layer | Role & Responsibility |
|:---|:---|:---|
| `cmd/server/main.go` | Runtime Entry Point | Initializes pools, Redis, FCM, mailer, mounts routers, manages OS shutdown signals |
| `cmd/seed/main.go` | CLI Utility | Standalone automated database seeder |
| `internal/modules/auth/` | Domain Module | Dual-identifier login (email/username), phone OTP, JWT access/refresh token rotation |
| `internal/modules/users/` | Domain Module | Profiles, demographics, single-photo gallery uploads, push tokens, account deletion |
| `internal/modules/chat/` | Domain Module | Direct/group chat, Socket.IO gateway (`/chat`), cursor message pagination, replies, typing |
| `internal/modules/matching/` | Domain Module | Feed candidate discovery, batch gallery lookups, atomic swipes via Redis Lua script |
| `internal/modules/recommended/`| Domain Module | 5-factor compatibility scoring (35% Qs, 25% Interests, 20% City, 10% Relation, 10% Age) |
| `internal/modules/friends/` | Domain Module | Bidirectional friend requests, auto-acceptance on mutual, friend removals |
| `internal/modules/media/` | Domain Module | Multipart file uploads, public asset URL resolution, magic byte validation |
| `internal/modules/admin/` | Domain Module | Backoffice APIs, user bans, session revocations, identity selfie review |
| `internal/modules/system/` | Domain Module | Health checks (`/health`), server time (`/time`), live hosted documentation |
| `internal/middleware/` | Presentation Layer | `envelope.go` (response standardizer), `auth.go` (JWT/ApiKey), `throttler.go` (Redis) |
| `internal/platform/database/` | Infrastructure | PostgreSQL 16 pool, numbered migrations (`migrations/`), `schema.sql`, `queries.sql` |
| `internal/platform/redis/` | Infrastructure | Redis 7 client, sliding-window rate limit, swipe Lua script, recommendation cache |
| `internal/platform/storage/` | Infrastructure | Local filesystem and S3/MinIO engines, WebP compression, image sanitization |
| `internal/platform/fcm/` | Infrastructure | Firebase Cloud Messaging dispatcher pool (live FCM with mock fallback) |
| `internal/platform/mail/` | Infrastructure | Outgoing SMTP mailer with STARTTLS support for verification OTP delivery |
| `internal/platform/geo/` | Infrastructure | In-memory dataset resolution (250 countries, 5,308 states, 152,970 cities) |
| `docs/` | Documentation | `CLIENT_DEV_GUIDE.md`, `RULES.md`, `asyncapi.json`, `api/swagger.yaml` |
| `.gsd/` | System State | `STATE.md`, `ARCHITECTURE.md`, `STACK.md` |

---

## 4. Non-Negotiable Contract & Domain Invariants

### 4.1 Single Canonical Contract (Strictly Zero Aliases)
- **Maintain a single, unambiguous contract for every DTO, API request, and API response.**
- Do NOT duplicate fields between parent/root payload structures and nested objects.
- Fields must have one and only one authoritative location in a request and response.
- **Strictly Forbid Redundant Field Aliases (`City`, `city`, `cityName`, `citiName`, etc.)**:
  - Never add artificial alias fields (`City`, `city`, `cityName`, `citiName`, `fcmToken`, `deviceToken`, `fcm_token`) to DTOs or JSON payloads.
  - In candidate DTOs (Feed `FeedCandidateDto`, Recommended `RecommendedCandidateDto`, Likes `LikedUserDto`), the city string field is canonically flat: `city: string | null`. Never add `cityName`, `City`, `Profile`, or other aliases to these flat DTOs.
  - In user profile responses (`GET /v1/users/profile`, `PUT /v1/users/profile`), city details reside exclusively at `Profile.Demographic.City` (`CityResponseDto` containing `id`, `name`, and nested `State: { id, name, Country }`). Never add alias properties such as `city`, `cityName`, or duplicate `City` at the root response level.
  - Always fix the root cause (data resolution, schema mapping, foreign key constraints, or service lookup) rather than polluting API contracts with fallback aliases.

### 4.2 Gallery & Profile Picture Update Rules (`PUT /v1/users/profile` & `POST /v1/users/profile`)
- **Single Image Upload Per Request**: Do NOT allow sending multiple gallery images in a single request. Only one gallery picture is permitted per request (`maxCount: 1`).
- **Gallery Payload as an Object**: In request payloads, `gallery` must be sent as a single object (`{ isProfilePicture?: boolean, description?: string }`), **never an array**.
- **Default `isProfilePicture`**: The `isProfilePicture` field can be omitted by the client. If not provided, the backend must automatically default `isProfilePicture: true` for the first gallery image upload.
- **Updating Existing Gallery Image by ID**: When both a gallery image file and `gallery.id` (or `id`) are provided in a request, the backend replaces the existing gallery item's image file and description with the new uploaded image instead of creating a new gallery item.
- **Selecting Existing Profile Picture via `profilePictureId`**: To select an existing gallery photo as the active profile picture, the client sends `profilePictureId` (integer ID) at the root level. No `profilePicture` string URL key is needed or accepted in the request.
- **Deleting Gallery Image by ID**: Authenticated users can delete an individual gallery photo via `DELETE /v1/users/gallery/:galleryId`. If the deleted photo was the active profile picture, the backend automatically falls back to another existing gallery photo or clears `profilePictureUrl`.
- **No `likesCount` in Gallery Response**: Gallery response objects returned to clients (`gallery`) do NOT include `likesCount`.
- **Strictly Outside `Profile`**: Both `gallery` and `profilePictureId` must strictly reside at the root level outside the `Profile` object. Never accept or duplicate them inside `Profile`.

### 4.3 No Route Aliases for APIs
- Do NOT add aliases for APIs (e.g. do NOT register multiple route paths like `['gallery/:galleryId', 'me/gallery/:galleryId']` for the same endpoint).
- Route aliases confuse client usage. Maintain one and only one canonical, unambiguous route per endpoint.

### 4.4 Real-Time Chat & Socket.IO Invariants
- **Deterministic 1:1 Conversation UUID**: Computed via RFC 4122 v5 UUID from canonical pair `min(userA, userB):max(userA, userB)` (`internal/common/canonical_pair.go`). Eliminates duplicate conversation creation races.
- **Index-Backed Timeline Pagination**: Message history queries MUST use `ListMessagesByConversationCursor` with index `idx_messages_conversation_created` on `(conversation_id, created_at DESC)`. **Never re-introduce day-by-day bucket loops.**
- **Reply Invariant**: Quoted `replyToMessageId` must belong to the exact same conversation. Otherwise, server returns `400 Bad Request`.
- **Typing Indicator TTL**: Active typing states (`typing`, `recording_voice`, `uploading_media`) are stored in Redis with an automatic 6-second TTL to prevent stuck typing indicators on disconnect.
- **Message Soft Deletion**: `DELETE /v1/conversations/{id}/messages/{id}` sets `is_deleted = true`, blanks content, and broadcasts `message.deleted`.
- **Read Receipts**: `POST /v1/conversations/{id}/read` sets caller unread count to 0 and broadcasts `conversation.read`.

### 4.5 Discovery & Recommendation Invariants
- **Candidate Eligibility**: In Feed (`GET /v1/feed`) and Recommended (`GET /v1/recommended`), strictly enforce `User.profileValidated == true`.
- **No Selfie Requirement**: Do NOT check or require `selfieUrl` on candidates. Validated users are eligible regardless of whether `selfieUrl` is present or null.
- **Batch Query Discipline (Zero N+1)**: Never query candidate galleries or profiles in a loop.
  - Use `ListGalleriesByUserIDs(ctx, candidateIDs)` in Feed.
  - Use `GetCandidateRecommendationProfilesByIDs(ctx, candidateIDs)` in Recommendations.

### 4.6 Device Token & Push Notification Invariants
- **Single Canonical Field Names**:
  - Push notification token field is strictly and exclusively `token`.
  - Device information field is strictly and exclusively `deviceInfo`.
  - Never add alias fields (`fcmToken`, `deviceToken`, `device_token`, `fcm_token`, `Token`, `DeviceInfo`, etc.) to DTOs, request bodies, or responses.
- **Canonical Endpoints**:
  - `PUT /v1/users/device-token`: Updates the authenticated session's device token and deviceInfo (requires user Bearer JWT).
  - `GET /v1/users/:userId/device-token`: Retrieves active token and deviceInfo by user ID (authenticated strictly via API key in `x-api-key` header / `ApiKey` auth, NOT user JWT).

---

## 5. Hardware-Aware Concurrency & Memory Safety

> [!CAUTION]
> This host has 20 CPU cores. Executing test runners or build tools without worker bounds spawns 20 parallel runtimes, exhausting host memory (>30 GB RAM) and causing kernel OOM kills.

- **Mandatory Worker Bounds on Tests**:
  - Go: `go test -p 4 ./...`
  - Node.js / Jest: `npm test -- --maxWorkers=4` or `npx jest --maxWorkers=4`
- Never execute unbounded test suites or compile commands across full CPU count.

---

## 6. Database Migrations & SQLC Workflow

When modifying database schemas or queries:
1. **Create Migrations**: Add sequential files `migrations/<NNNN>_<desc>.up.sql` and `migrations/<NNNN>_<desc>.down.sql`.
2. **Update Schema & Queries**: Add the DDL to `internal/platform/database/schema.sql` and the typed queries to `internal/platform/database/queries.sql`.
3. **Run Code Generation**: Execute `sqlc generate` to regenerate `internal/platform/database/db/`.
4. **Apply to Staging DB**: Apply migration to container `datemate_dev_postgres`:
   ```bash
   ssh datemate "docker exec -i datemate_dev_postgres psql -U postgres -d datemate_db < /var/develop/migrations/<NNNN>_<desc>.up.sql"
   ```

---

## 7. Git Workflow & Autonomous Delivery Protocol

To maintain a clean, consistent, and traceable Git history while enabling fast-paced AI delivery:

### 7.1 Autonomous End-to-End Delivery Loop
- When a task, bug fix, or feature is empirically verified by tests (`go test -p 4 ./...`):
  1. **Atomic Conventional Commit**: Automatically stage and commit changes with clean Conventional Commits on the dedicated working branch.
  2. **Push Branch**: Automatically push the feature/bugfix branch to the remote repository.
  3. **Staging Deployment**: Automatically sync the workspace to the dev server (`/var/develop`), apply any pending `.up.sql` migrations to `datemate_db`, and rebuild the backend container (`docker compose -p datemate_dev build backend && docker compose -p datemate_dev up -d backend`).
  4. **Live Verification**: Empirically verify the live endpoints on `https://dev-datemate.testdevvvv.site` so the user can immediately test without having to manually request commits, pushes, or deployments.

### 7.2 Branch Management & Branch Protection
- **Direct Pushes Forbidden**: Never push directly to the `develop` or `master` branch.
- All changes must be developed on a dedicated `feature/<name>`, `bugfix/<name>`, or `hotfix/<name>` branch.
- Push changes only to your dedicated working branch.
- Changes must be integrated into `develop` through a Merge Request (MR).
- All Merge Requests must be reviewed and approved before merging.

### 7.3 Hotfix Workflow
- Hotfix branches are intended for critical issues that require immediate fixes.
- Create a dedicated `hotfix/<name>` branch for urgent production issues.
- Hotfixes should be prioritized and addressed immediately.
- Submit a Merge Request as soon as the fix is verified.
- Hotfixes must still follow the code review and approval process.
- After merging, ensure the fix is also applied to other relevant branches (such as `develop`) to prevent regression.

**Branch naming examples:**
- `feature/add-user-authentication`
- `bugfix/fix-email-validation`
- `hotfix/fix-payment-failure`

### 7.4 Commit Message Convention
- Follow the Conventional Commits standard for every commit.
- Each commit must represent one logical change (Atomic Commit).
- Commit messages must be clear, concise, and meaningful.
- Use the appropriate commit type:
  - `feat`: New feature
  - `fix`: Bug fix
  - `hotfix`: Urgent production fix
  - `perf`: Performance optimization
  - `refactor`: Code restructuring without behavioral changes
  - `docs`: Documentation updates
  - `test`: Test suite additions/modifications
  - `chore`: Maintenance tasks

**Format:** `<type>(<scope>): <description>`

**Examples:**
- `feat(chat): implement reply-to-messages and real-time typing indicator states`
- `perf(chat, discovery): optimize timeline pagination and eliminate N+1 queries`
- `fix(auth): resolve verification code delivery race condition`
- `docs(rules): synchronize API contracts and staging deployment guide`

---

## 8. Staging Server Details & Dev Deployment

- **Public Endpoint**: `https://dev-datemate.testdevvvv.site`
- **Dev Server SSH**: `ssh datemate` (Host: `65.109.186.39`, Target Directory: `/var/develop`)
- **Docker Compose Project**: `docker compose -p datemate_dev`
  - Backend: `datemate_dev_backend` (Port 2021 internally mapped to public domain)
  - Database: `datemate_dev_postgres` (Database: `datemate_db`, Port 5433)
  - Redis: `datemate_dev_redis` (Port 6380)
- **Live Documentation Endpoints**:
  - Interactive Client Guide: `GET /client-guide` (also `?format=raw`, `?format=json`, `?download=1`)
  - Platform Rules: `GET /docs/rules`
  - AsyncAPI WebSockets: `GET /docs/asyncapi-json`
  - OpenAPI / Swagger: `GET /docs-yaml`
