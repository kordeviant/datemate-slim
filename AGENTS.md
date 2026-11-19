# DateMate Backend AI Development Engine & Rules

> **Audience**: Autonomous AI Coding Agents (Antigravity, Cursor, Claude Code, Copilot, Windsurf) and Engineers.  
> **Mission**: Build, refactor, and maintain DateMate's high-performance modular monolith backend with zero hallucination, sub-millisecond execution discipline, and strict contract fidelity.

---

## 1. Fast-Paced AI Autonomous Execution Protocol

1. **Context-First Discovery**:
   - Check `.gsd/STATE.md` and `.gsd/ARCHITECTURE.md` before searching loose files.
   - Use targeted line reads (`StartLine`, `EndLine`). Avoid dumping entire multi-hundred line files into context.
2. **Atomic & Deterministic Changes**:
   - Decompose tasks into small, verifiable steps.
   - Maintain pure business logic in domain services (`internal/modules/<domain>/service.go`); keep infrastructure drivers isolated in `internal/platform/`.
3. **Mandatory Empirical Verification**:
   - Never say "it should work" without running tests or builds.
   - Always verify Go tests with the **`-p 4` worker bound**: `go test -p 4 ./...`.
4. **SQLC Synchronization**:
   - Any modification to `internal/platform/database/queries.sql` or `schema.sql` MUST immediately be followed by `sqlc generate`.
5. **Autonomous Delivery & Staging Deployment Protocol**:
   - When a task, bug fix, or feature is empirically verified by tests (`go test -p 4 ./...`):
     1. Automatically commit changes with clean Conventional Commits (`feat(...)`, `fix(...)`, `perf(...)`, `docs(...)`) on the dedicated working branch.
     2. Automatically push the branch to the remote repository.
     3. Automatically sync the workspace to the dev server (`/var/develop`), apply any pending `.up.sql` migrations to `datemate_db`, and rebuild the backend container (`docker compose -p datemate_dev build backend && docker compose -p datemate_dev up -d backend`).
     4. Empirically verify the live endpoints on `https://dev-datemate.testdevvvv.site` so the user can immediately test without having to manually request commits, pushes, or deployments.

---

## 2. Fast Command Cheatsheet for AI Agents

| Task | Command | Constraints & Invariants |
|:---|:---|:---|
| **Run All Tests** | `go test -p 4 ./...` | **Worker bound `-p 4` is mandatory** on 20-core host |
| **Run Targeted Test** | `go test -p 4 -v ./test/ -run "TestName"` | Fast single-test feedback |
| **Generate SQLC Code** | `sqlc generate` | Recompiles type-safe DB querier and structs |
| **Run Server Locally** | `go run ./cmd/server` | Chi HTTP router + Socket.IO on port 3000 |
| **Run Database Seeder** | `go run ./cmd/seed --all` | Seeds reference geo, questions, interests, test users |
| **Compile Binary** | `CGO_ENABLED=1 go build -ldflags="-s -w" -o bin/server ./cmd/server` | Multi-stage slim CGO build |
| **Sync Staging Code** | `rsync -avz --exclude '.git' --exclude 'uploads' --exclude 'bin' ./ datemate:/var/develop/` | Syncs workspace to dev server |
| **Apply Staging Migration**| `ssh datemate "docker exec -i datemate_dev_postgres psql -U postgres -d datemate_db < /var/develop/migrations/<file>.up.sql"` | Runs migration on staging DB |
| **Rebuild Staging Daemon** | `ssh datemate "cd /var/develop && docker compose -p datemate_dev build backend && docker compose -p datemate_dev up -d backend"` | Recreates staging backend container |

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
- **Maintain a single, unambiguous contract for every DTO, request, and response.**
- **No Redundant Field Aliases**:
  - Never add artificial alias fields (`City`, `city`, `cityName`, `citiName`, `fcmToken`, `deviceToken`, `fcm_token`) to DTOs or JSON payloads.
  - In candidate DTOs (Feed `FeedCandidateDto`, Recommended `RecommendedCandidateDto`, Likes `LikedUserDto`), the city string field is canonically flat: `city: string | null`. Never add `cityName` or nest inside `Profile`.
  - In user profile responses (`GET /v1/users/profile`, `PUT /v1/users/profile`), city details reside exclusively at `Profile.Demographic.City` (`CityResponseDto` containing `id`, `name`, and nested `State`).
- **No Route Aliases**: Maintain one and only one canonical route per endpoint. Never register multiple paths for the same handler.

### 4.2 Gallery & Profile Photo Rules (`PUT /v1/users/profile` & `POST /v1/users/profile`)
- **Single Image Upload Per Request**: Only 1 gallery photo per upload request (`maxCount: 1`).
- **Gallery Payload as an Object**: Request payload `gallery` must be sent as a single object (`{ isProfilePicture?: boolean, description?: string }`), **never an array**.
- **Root Level Strictness**: Both `gallery` and `profilePictureId` reside strictly at the root level outside the `Profile` object. Never accept or duplicate them inside `Profile`.
- **Selecting Profile Picture**: Send integer `profilePictureId` at root level. No `profilePicture` string URL key is accepted in requests.
- **Replacing Existing Photo**: When both an image file and `gallery.id` are provided, replace the existing item rather than creating a new one.
- **Deleting Gallery Photo**: `DELETE /v1/users/gallery/:galleryId` falls back to another photo or clears `profilePictureUrl` if the active photo was deleted.
- **No `likesCount` in Response**: Gallery response objects returned to clients do NOT include `likesCount`.

### 4.3 Real-Time Chat & Socket.IO Invariants
- **Deterministic 1:1 Conversation UUID**: Computed via RFC 4122 v5 UUID from canonical pair `min(userA, userB):max(userA, userB)` (`internal/common/canonical_pair.go`). Eliminates duplicate conversation creation races.
- **Index-Backed Timeline Pagination**: Message history queries MUST use `ListMessagesByConversationCursor` with index `idx_messages_conversation_created` on `(conversation_id, created_at DESC)`. **Never re-introduce day-by-day bucket loops.**
- **Reply Invariant**: Quoted `replyToMessageId` must belong to the exact same conversation. Otherwise, server returns `400 Bad Request`.
- **Typing Indicator TTL**: Active typing states (`typing`, `recording_voice`, `uploading_media`) are stored in Redis with an automatic 6-second TTL to prevent stuck typing indicators on disconnect.
- **Message Soft Deletion**: `DELETE /v1/conversations/{id}/messages/{id}` sets `is_deleted = true`, blanks content, and broadcasts `message.deleted`.
- **Read Receipts**: `POST /v1/conversations/{id}/read` sets caller unread count to 0 and broadcasts `conversation.read`.

### 4.4 Discovery & Recommendation Invariants
- **Candidate Eligibility**: In Feed (`GET /v1/feed`) and Recommended (`GET /v1/recommended`), strictly enforce `User.profileValidated == true`.
- **No Selfie Requirement**: Do NOT require `selfieUrl` on candidates. Validated users are eligible regardless of whether `selfieUrl` is present or null.
- **Batch Query Discipline (Zero N+1)**: Never query candidate galleries or profiles in a loop.
  - Use `ListGalleriesByUserIDs(ctx, candidateIDs)` in Feed.
  - Use `GetCandidateRecommendationProfilesByIDs(ctx, candidateIDs)` in Recommendations.

### 4.5 Device Token & Push Notification Invariants
- **Canonical Field Names**: Push token field is strictly `token`. Device info field is strictly `deviceInfo`.
- **Endpoints**:
  - `PUT /v1/users/device-token`: Updates session token (requires user Bearer JWT).
  - `GET /v1/users/:userId/device-token`: Queries token by user ID (authenticated strictly via API Key `x-api-key`, NOT user JWT).

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

## 7. Git Workflow & Autonomous Delivery Guidelines

- **Autonomous End-to-End Delivery**:
  - Once code changes pass all tests and verification (`go test -p 4 ./...`), automatically stage and commit them.
  - Automatically push the feature/bugfix branch to the remote repository.
  - Deploy to the staging server and verify so the user never has to babysit the agent or ask "is it committed? is it deployed?".
- **Branch Protection Guardrails (Strict)**:
  - **Never push directly to `develop` or `master`**.
  - All changes must be developed on a dedicated working branch: `feature/<name>`, `bugfix/<name>`, or `hotfix/<name>`.
  - Always provide the GitLab Merge Request (MR) URL upon pushing so the team can review and merge cleanly into `develop`.
- **Conventional Commits Standard**:
  Format: `<type>(<scope>): <description>`
  - `feat`: New feature
  - `fix`: Bug fix
  - `perf`: Performance optimization
  - `refactor`: Restructuring without behavioral changes
  - `docs`: Documentation updates
  - `test`: Test suite additions/modifications
  - `chore`: Maintenance tasks
  - *Examples*:
    - `feat(chat): implement reply-to-messages and real-time typing indicator states`
    - `perf(chat, discovery): optimize timeline pagination and eliminate N+1 queries`
    - `fix(auth): resolve verification code delivery race condition`

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
