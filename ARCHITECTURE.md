# DateMate Backend Architecture

## 1. Architectural Paradigm: Modular Monolith + Clean Architecture + DDD

DateMate is architected as a **Modular Monolith** applying **Domain-Driven Design (DDD)** and **Clean Architecture** principles. The system enforces strict boundaries between business logic and infrastructure to enable effortless maintenance, high test coverage, and a frictionless path to independent microservices when required.

### Layer Separation
1. **Domain Layer**: Pure business entities, enums, value objects, and repository/storage interfaces (`IStorageEngine`, `IUserRepository`). Zero external dependencies.
2. **Application Layer**: Use cases, DTOs, domain validators, and orchestrators (`UploadMediaUseCase`, `GetProfileUseCase`, `MediaUrlResolverService`).
3. **Infrastructure Layer**: Concrete persistence and driver implementations (`LocalStorageService`, `S3StorageService`, `PrismaUserRepository`, `RedisService`, `NodemailerService`).
4. **Presentation Layer**: NestJS controllers handling HTTP transport, OpenAPI/Swagger specifications, and input transformation (`AssetsController`, `MediaUploadController`, `UsersController`, `AuthController`).

---

## 2. Media Upload & Scalable Asset System (`src/modules/media`)

### 2.1 Core Design Goals
- **Scalable Route Architecture**: Provides clean, dedicated routes for asset categories:
  - `/assets/icons/{filename}`
  - `/assets/images/{filename}`
  - `/assets/avatars/{filename}`
  - `/assets/selfies/{filename}`
  - `/assets/{type}/{filename}` (extensible to future types without code modification)
- **Decoupled Storage & Public URL Independence**:
  - The storage layer stores files organized by asset type (`uploads/<assetType>/<filename>` or `s3://<bucket>/<assetType>/<filename>`).
  - Stored database references hold relative keys (e.g. `icons/icon_123.svg`, `avatars/avatar_456.webp`).
  - The public URL is resolved dynamically using the configured `baseUrl`.
- **Zero-Migration Domain Changes**:
  - `baseUrl` is read from environment configuration (`ASSET_BASE_URL` -> `MEDIA_BASE_URL` -> `APP_BASE_URL` -> `http://localhost:<PORT>`).
  - Migrating to a CDN (e.g. `https://cdn.datemate.com`) requires only modifying `.env`; no database records require alteration.
- **Unique, Safe Filename Generation**:
  - Filenames follow the pattern: `<assetType>_<uuidHex>_<timestamp>.<safeExt>` (e.g. `icons_8f3e2b9c_1727599000000.svg`).
  - Strict protection against directory traversal (`..`, `/`, `\`, null bytes).
  - Cross-platform sanitized path handling.
- **Binary Inspection & Validation**:
  - Validates magic bytes for authentic JPEG, PNG, WebP, GIF, and PDF formats.
  - Cleans and sanitizes SVGs against embedded `<script>` or event handler XSS attacks.
  - Enforces size boundaries per asset type rule.

### 2.2 Storage Engine Abstraction (SOLID DIP & OCP)
```mermaid
flowchart TD
    Client["Client / Mobile App"] --> Controller["AssetsController / MediaUploadController"]
    Controller --> UseCase["UploadMediaUseCase / GetMediaStreamUseCase"]
    UseCase --> Engine["IStorageEngine (Interface)"]
    Engine --> LocalStorage["LocalStorageService (Local Disk uploads/)"]
    Engine --> S3Storage["S3StorageService (AWS S3 / Cloudflare R2 / MinIO)"]
    UseCase --> UrlResolver["MediaUrlResolverService (baseUrl from .env)"]
    UrlResolver --> PublicUrl["Full Public URL: https://cdn.datemate.com/assets/{type}/{filename}"]
```

### 2.3 Asset Type Registry
An extensible registry (`AssetTypeRegistry`) defines validation rules, MIME types, and size limits per asset type. Adding a new asset type (e.g., `banners`, `audio`, `documents`) only requires registering a configuration rule:
```typescript
registry.register({
  assetType: 'banners',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  maxSizeBytes: 10 * 1024 * 1024,
  magicBytesValidation: true,
  description: 'Event and promotional banners',
});
```

---

## 3. Configuration Reference

| Environment Variable | Default | Purpose |
| :--- | :--- | :--- |
| `ASSET_BASE_URL` | `http://localhost:3000` | Authoritative public base domain for asset URLs |
| `MEDIA_BASE_URL` | *(optional fallback)* | Secondary asset base domain fallback |
| `APP_BASE_URL` | *(optional fallback)* | Application base URL fallback |
| `STORAGE_DRIVER` | `local` | Storage driver engine: `local` or `s3` |
| `UPLOADS_DIR` | `uploads` | Local disk storage root directory |
| `S3_BUCKET` | `datemate-media` | S3 bucket name when `STORAGE_DRIVER=s3` |
| `S3_REGION` | `us-east-1` | S3 bucket region |
| `S3_ENDPOINT` | *(optional)* | S3 endpoint override for MinIO / Cloudflare R2 |
| `RECOMMENDED_CACHE_TTL` | `86400` | Recommended candidate pool Redis cache duration in seconds (default: 86400 = 1 day) |
| `DOCS_IP_WHITELIST_ENABLED` | `false` | Enable/disable IP whitelist check for Swagger docs and /docs/rules (`true`/`false`) |
| `DOCS_ALLOWED_IPS` | `127.0.0.1,::1` | Comma-separated list of whitelisted IPs permitted to access docs and rules |
| `DOCS_AUTH_ENABLED` | `true` | Enable/disable HTTP Basic Auth login prompt for docs and rules (`true`/`false`) |
| `DOCS_USERNAME` | `admin` | HTTP Basic Auth username required to view docs and rules |
| `DOCS_PASSWORD` | `datemate_docs_password_2026` | HTTP Basic Auth password required to view docs and rules |
| `THROTTLE_TTL` | `60000` | Global rate limit rolling window duration in milliseconds (default: 60000 = 60s) |
| `THROTTLE_LIMIT` | `120` | Global maximum requests per IP permitted within THROTTLE_TTL window (default: 120) |
| `TRUST_PROXY` | `loopback` | Express trust proxy mode (`loopback`, `1`, `true`, CIDR). Prevents client IP spoofing |

---

## 4. API Specification

### Media Upload Endpoints
- `POST /v1/media/upload/:type` (and `/assets/upload/:type`): Multipart upload for any registered asset type.
- `POST /v1/media/upload/icons`: Dedicated icon upload.
- `POST /v1/media/upload/images`: Dedicated image upload.
- `POST /v1/media/upload/avatars`: Dedicated avatar upload.
- `GET /v1/media/types`: Returns supported asset types, allowed formats, and size constraints.

### Public Asset Endpoints
- `GET /assets/icons/:filename`: High-performance icon streaming with `ETag` and `304 Not Modified` support.
- `GET /assets/images/:filename`: High-performance image streaming.
- `GET /assets/avatars/:filename`: High-performance avatar streaming.
- `GET /assets/selfies/:filename`: High-performance selfie verification photo streaming.
- `GET /assets/:type/:filename`: Scalable endpoint dynamically serving any registered asset category.

---

## 5. Interests Module (`src/modules/interests`)

The Interests module provides category-based discovery of user hobbies and activities matching the mobile UI.

### 5.1 Architecture & Domain Invariants
- **Domain Entities**: `InterestCategoryEntity` and `InterestEntity` representing categories and their child interests.
- **Client Response Format**: Matches Android client schema:
  ```json
  [
    {
      "id": 1,
      "en": "Food",
      "fa": "غذا",
      "icon": {
        "type": "IMAGE",
        "url": "http://localhost:3000/assets/icons/Beach%20With%20Umbrella.svg",
        "alt": ""
      },
      "Interest": [
        {
          "id": 1,
          "en": "Gaming",
          "fa": "بازی"
        }
      ]
    }
  ]
  ```
- **Endpoints**:
  - `GET /interests` (and `GET /interest`): Retrieves list of categories with child interests. Supports optional `language` (en, fa) and `id` filter.
  - `GET /interests/:id`: Retrieves a single category with child interests.
  - `POST /interests` (and `POST /interest`): Admin-only category creation with child interests.
- **User Profile Integration**:
  - `GET /users/me`: Returns selected interests in `Profile.LikedActivities` as `{ [categoryId]: interestId | interestId[] }` (omitting duplicate `interest` / `interests`).
  - `PUT /users/me`: Updates selected user interests via `LikedActivities` key-value map, flat IDs, or category objects.
- **Seeding**:
  - Seed script: `npm run seed:interests` (`npx ts-node prisma/seed-interests.ts`).
  - Reads SVG icons from `seed-icons/intersets` or `seed-icons/interests` in project root and copies them to `uploads/icons/`.

---

## 6. Admin Panel Module (`src/modules/admin`)

The Admin Module provides administration, monitoring, user directory search, account moderation, and identity verification capabilities for platform operators.

### 6.1 Architecture & Domain Invariants
- **Bounded Context**: Dedicated `admin` domain isolated from consumer authentication and mobile profile endpoints.
- **Role-Based Security**: Secured with `AdminAuthGuard` requiring valid JWT with `role === 'ADMIN'`.
- **Session Termination on Ban**: Banning a user automatically purges all their active sessions (`user_sessions`) in real-time.
- **Identity Verification Notification**: Approving or rejecting a verification triggers `NotificationType.PROFILE_VERIFIED` to inform the user.

### 6.2 Administrative Endpoints
- `GET /v1/admin/dashboard/stats` (also `/v1/admin/dashboard/overview`): Returns KPI metrics (`totalUsers`, `onlineUsers`, `pendingSelfies`, `unansweredTickets`), weekly activity, gender stats, recent tickets, and `recentSelfies` (strictly returning the last 4 unvalidated users who have an existing `selfieUrl`).
- `GET /v1/admin/users/count`: Returns the total registered user count, supporting optional status filtering (`ALL`, `PENDING_VERIFICATION`, `BLOCKED`, `ONLINE`).
- `GET /v1/admin/users/pending-selfies/count`: Returns the count of unvalidated users who have a non-empty selfie URL and `profileValidated = false`.
- `GET /v1/admin/users`: Lightweight paginated user directory with multi-field search (`search`), status filters (`ALL`, `BLOCKED`, `PENDING_VERIFICATION`, `COMPLETED`), gender filters (`MALE`, `FEMALE`, `ALL`), age range filters (`minAge`, `maxAge`), and sorting (`createdAt`, `lastSeenAt`, `wallet`). Excludes heavy payloads (gallery, bio, transactions, chatRooms) for fast listing. Returns `id`, `email`, `fullName`, `avatarUrl`, `age`, `gender`, `isPremium`, `hasPendingSelfie`, `profileValidated`, `isOnline`, `bannedUntil`, and `createdAt`.
- `GET /v1/admin/users/:id`: Full user details endpoint providing complete inspection data for the admin details modal/tabs: demographics, full photo gallery, transactions, chatRooms, **devices** (list of user sessions: `id`, `deviceInfo`, `fcmToken`, `isActive`, `expiresAt`, `createdAt`), **likes** (list of right swipes received and sent: `id`, `userId`, `fullName`, `username`, `avatarUrl`, `city`, `type` ['RECEIVED' | 'SENT'], `createdAt`), and interests.
- `DELETE /v1/admin/users/:userId/devices/:deviceId`: Terminate device session endpoint allowing administrators to terminate / log out an active device session of a user by userId and deviceId (session ID). Returns `{ success: true, message: "Device session terminated successfully", data: { userId, deviceId, terminated: true } }`.
- `DELETE /v1/admin/users/:userId/devices`: Terminate all device sessions endpoint allowing administrators to terminate / log out all device sessions of a user by userId. Returns `{ success: true, message: "All user device sessions terminated successfully", data: { userId, terminated: true, count: number } }`.
- `DELETE /v1/admin/users/:id`: Permanently deletes a single user by ID and cascades through all associated records (sessions, profile, demographics, gallery, swipes, matches, messages). Strictly deletes only one user per request (multi-user delete is not supported).
- `DELETE /v1/admin/users/:userId/gallery/:galleryId`: Deletes a specific gallery photo for a user. If the deleted photo was the active profile picture, the backend automatically falls back to another gallery photo or clears `profilePictureUrl`. Returns `{ success: true, message: "Gallery image deleted successfully", data: { userId, galleryId, deleted: true } }`.
- `PATCH / PUT /v1/admin/users/:id`: Updates user moderation fields (bio, fullName, premium, wallet, and confirms selfie verification).
- `POST /v1/admin/users/:id/ban`: Bans/blocks user account with duration in hours or permanent ban (`null`).
- `POST /v1/admin/users/:id/unban`: Unbans user account and restores full access.
- `GET /v1/admin/verifications/count` (also `/v1/admin/verifications/pending/count`): Returns count of unvalidated users whose selfie is not validated, who have an existing selfie URL, and `profileValidated = false`.
- `GET /v1/admin/verifications`: Paginated queue of identity selfie reviews displaying user details (`id`, `userId`, `fullName`, `email`, `avatarUrl`, `selfieUrl`, `age`, `gender`, `requestedAt` ISO string, `status`). Strictly filters for users with an existing selfie photo (`selfieUrl` is not null/empty), and for `PENDING` status only returns unvalidated users (`profileValidated = false`). Supports `status` filter (`PENDING`, `APPROVED`, `REJECTED`, `ALL`), `page`, and `limit`.
- `POST /v1/admin/verifications/:id/approve`: Validates user profile (`profileValidated = true`) by verification request ID or userId, creates `PROFILE_VERIFIED` notification, and returns `{ success: true, message: "Verification approved successfully", ... }`.
- `POST /v1/admin/verifications/:id/reject`: Rejects verification by verification request ID or userId, clears `selfieUrl`, sets `profileValidated = false`, and fires notification explaining rejection reason. Accepts `{ reason?: string }` body and returns `{ success: true, message: "Verification rejected successfully", ... }`.

---

## 7. User Gallery & Swipe Profile Picture System (`src/modules/auth`)

The User Gallery system enables users to upload, manage, and curate their photo gallery for profile discovery and matching.

### 7.1 Architecture & Domain Invariants
- **Profile Picture vs. Avatar**:
  - `avatar`: Dedicated identity verification photo (stored in `Profile.avatarUrl`, served via `/assets/avatars/...`).
  - `profilePicture`: The primary public swipe picture used in the matching/discovery deck (stored in `Profile.profilePictureUrl`, served via `/assets/images/...`).
  - `Profile.profilePictureUrl` is persisted in nullable `profiles.profile_picture_url` (added by the `20261004130000_add_profile_picture_url_to_profiles` migration).
  - `Profile.profilePictureId`: Gallery ID of the currently active profile picture, returned in profile response.
  - `UserGallery.isProfilePicture`: Boolean flag designating which gallery item is currently active for swiping.
- **Multipart Upload Fields**:
  - Only three distinct file fields are accepted on profile update endpoints (`PUT /v1/users/profile` and `POST /v1/users/profile`):
    - `avatar?: Express.Multer.File[]` (max 1)
    - `selfie?: Express.Multer.File[]` (max 1)
    - `gallery?: Express.Multer.File[]` (max 1 - multiple gallery photo uploads in a single request are rejected)
- **Gallery Object & Profile Picture Updating**:
  - `gallery` in request body is a single object: `{ isProfilePicture?: boolean, image?: string, description?: string, id?: number }`.
  - `isProfilePicture` is optional: if omitted, the backend sets the user's first gallery image as `isProfilePicture: true` by default.
  - **In-place Gallery Update by ID**: When both a gallery image file and `gallery.id` are sent in the request, the backend replaces the existing gallery item's photo and description in-place without creating a duplicate record or counting towards the 10-image limit.
  - `profilePictureId`: integer gallery ID passed in request to select an existing or uploaded gallery photo as active profile picture.
  - **Single Canonical Contract**: `gallery` and `profilePictureId` are strictly sent outside the `Profile` object at the root level (no duplicated fields across root and nested objects). There is **no need** for `profilePicture` string URL in the request.

### 7.2 Validation Boundaries & Upload Rules
- **Resolution**: Resolution restriction removed for gallery uploads (no minimum 1200×800 or maximum dimension restriction; image dimensions are extracted for metadata and converted to WebP).
- **File Size Limits**: Minimum **50KB** and maximum **10MB** per photo.
- **Maximum Photos Per Upload**: 1 photo per request (multi-photo gallery requests are rejected with 400 Bad Request).
- **Maximum Total Upload Size**: 10MB per request.
- **Accepted Formats**: WebP (recommended) and JPG/JPEG/PNG. All images are normalized, EXIF-rotated, stripped of metadata, and converted to WebP via Sharp.
- **Gallery Total Capacity**: Maximum 10 photos stored per user (`projected = current - deleteCount + newUploads <= 10`).

### 7.3 Profile Response
`GET /v1/users/me`, `GET /v1/users/:id`, and `PUT /v1/users/profile` return the canonical client ProfileResponseDto:
```json
{
  "Profile": {
    "avatar": "http://localhost:3000/assets/avatars/avatar_1.webp",
    "profilePicture": "http://localhost:3000/assets/images/gallery_1_123.webp",
    "profilePictureId": 12
  },
  "gallery": [
    {
      "id": 12,
      "url": "http://localhost:3000/assets/images/gallery_1_123.webp",
      "description": "Weekend trip",
      "isProfilePicture": true,
      "createdAt": "2026-10-04T12:00:00.000Z"
    }
  ]
}
```

### 7.4 Gallery Image Deletion (`DELETE /v1/users/gallery/:galleryId`)
- **Self-Service Gallery Photo Delete**: Authenticated users can delete a specific photo from their gallery by `galleryId`.
- **Active Profile Picture Fallback**: If the deleted photo was the active profile picture, the backend automatically falls back to another existing gallery photo or sets `profilePictureUrl: null`.
- **Physical File Cleanup**: Attempts physical file deletion from disk (`uploads/` directory).
- **Response Contract**: Returns `{ status: "success", success: true, message: "Gallery image deleted successfully", data: { userId, galleryId, deleted: true } }`.
- **Bulk Deletion**: Bulk removals can also be executed in `PUT /v1/users/profile` via `deleteGalleryIds: [id1, id2]`.

### 7.5 User Account Deletion (`DELETE /v1/users/me` & `/v1/users/account`)
- **Self-Service Account Purge**: Authenticated users can permanently delete their own account.
- **Cascading Purge**: Removes user sessions, profiles, demographics, preferences, personalities, galleries, swipes, matches, and messages. Cleans up associated media files from local storage.
- **Response Contract**: Returns `{ status: "success", message: "Account deleted successfully", data: { userId, deleted: true } }`.

### 7.6 Client User Profile Retrieval (`GET /v1/users/:id`)
- **Target Profile Inspection**: Allows authenticated clients to inspect any user's profile card by ID (e.g., when opening a profile from Feed or Matches).
- **Canonical Response Contract**: Returns the identical `ProfileResponseDto` schema as `GET /v1/users/me` (`id`, `email`, `language`, `lat`, `lon`, `profileValidated`, `isPremium`, `Profile: { fullName, username, phoneNumber, bio, languages, avatar, profilePicture, profilePictureId, profileCompleted, Demographic, RelationType, Answers, LikedActivities }`, and `gallery`).
- **Error Handling**: Missing or invalid token returns `401 Unauthorized`; non-existent user ID returns `404 Not Found`.

---


## 8. Authentication & Admin Sign-In (`src/modules/auth`)

The Authentication module supports consumer mobile applications and web administration portals with unified credentials.

### 8.1 Dual Identifier Sign-In (`POST /v1/auth/signin` & `/auth/signin`)
- **Flexible Identifier**: Accepts either `username` or `email` (or `usernameOrEmail` alias).
  - Searches `Profile.username` and `User.email` case-insensitively.
- **Web & Mobile Compatibility**:
  - Android client attestation fields (`integrityToken`, `packageName`, `device`, `userAgent`, `fcmToken`) are optional.
  - Web applications (such as Admin Panels) can authenticate by providing only:
    ```json
    {
      "username": "admin",
      "password": "Password123!"
    }
    ```
    or
    ```json
    {
      "email": "admin@datemate.com",
      "password": "Password123!"
    }
    ```
- **Device Information Default**: If client device metadata is omitted, `deviceInfo` defaults gracefully to `'Web Browser'`.
- **Role Propagation**:
  - JWT access tokens encode `role` in the payload (`role: 'ADMIN' | 'USER'`).
  - Auth response returns the authenticated user's role:
    ```json
    {
      "userId": 18,
      "access": "<jwt_access_token>",
      "refresh": "<refresh_token>",
      "role": "ADMIN"
    }
    ```
- **Admin Seeding**: Seeded admin user can be provisioned via `npm run seed:users` (`admin` / `admin@datemate.com`).

### 8.2 Client Logout API (`POST /v1/auth/logout` & `/auth/logout`)
- **Flexible Token Handling**: Accepts session refresh token (`refreshToken` or `token` alias) in JSON body, and/or bearer access token in `Authorization: Bearer <token>` header.
- **Single-Device or All-Devices Revocation**:
  - By default, revokes the specific session tied to the provided `refreshToken`.
  - When `allDevices: true` is sent, immediately terminates all active sessions across all devices for the authenticated user.
  - If only the `Authorization` bearer token is provided without a `refreshToken`, revokes the user's active sessions.
- **Graceful Token Expiry Handling**: If the bearer access token is expired, clients can still log out successfully by providing their `refreshToken` in the request body.
- **Standard Response Contract**: Returns `{ status: "success", message: "Logged out successfully", data: { loggedOut: true } }`.

### 8.3 Client Device Management & Termination (`GET /v1/users/devices`, `DELETE /v1/users/devices/:deviceId`, `DELETE /v1/users/devices`)
- **Get Active & Inactive Devices (`GET /v1/users/devices`)**:
  - Retrieves all device sessions for the authenticated user with explicit categorization (`devices`, `activeDevices`, `inactiveDevices`, `total`, `activeCount`, `inactiveCount`).
  - Automatically identifies whether each session is currently active (`isActive = true` when `expiresAt > now`).
  - Automatically tags the caller's current session (`isCurrent = true`) when `x-refresh-token` header or `refreshToken` query parameter is supplied.
  - Standard response envelope: `{ status: "success", message: "User devices retrieved successfully", data: { devices, activeDevices, inactiveDevices, total, activeCount, inactiveCount } }`.
- **Terminate a Specific Device Session (`DELETE /v1/users/devices/:deviceId`)**:
  - Authenticated user can terminate/log out any specific device session by deviceId.
  - Strictly verifies that the session belongs to the authenticated user (returns 404 if not found or belongs to another user).
  - Standard response envelope: `{ status: "success", success: true, message: "Device session terminated successfully", data: { deviceId, terminated: true } }`.
- **Terminate All Devices or All Except Current (`DELETE /v1/users/devices`)**:
  - When `excludeCurrent` is omitted or `false`, terminates all active and inactive device sessions for the authenticated user.
  - When `excludeCurrent=true`, terminates all device sessions EXCEPT the current caller's session. Requires the current session's refresh token passed via `x-refresh-token` header, query parameter, or JSON request body.
  - Standard response envelope: `{ status: "success", success: true, message: "Device sessions terminated successfully", data: { terminatedCount, excludedCurrent } }`.

---

## 9. Matching & Swipes Module (`src/modules/matching`)

The Matching module provides candidate discovery (feed deck), high-throughput atomic swiping, and likes-received inspection designed for high scale and low latency.

### 9.1 Core Domain Philosophy & Business Rules
- **No Mutual Match Gate**: Unlike traditional dating apps that require a mutual right-swipe before revealing interest, DateMate allows users to directly inspect everyone who liked them (`GET /v1/likes`).
- **Sub-50ms Fast Swiping (`POST /v1/swipes`)**:
  - The client submits `{ targetUserId: number, direction: 'RIGHT' | 'LEFT' }`.
  - The backend executes an in-memory Redis update and persists to PostgreSQL.
  - Returns a minimal HTTP 200 OK (`{ status: "success", message: "Swipe recorded successfully" }`) **without hydrating matched user details**, ensuring maximum write throughput and sub-50ms response times.
- **Strict 6 Feed Selection Invariants (`GET /v1/feed`)**:
  The candidate feed deck (default 20 cards) is strictly filtered by:
  1. **Exclude Self**: `candidate.id != currentUserId`.
  2. **Exclude Already Swiped (with Loop Fallback)**: By default, excludes users previously swiped (Right or Left) via Redis in-memory set and PostgreSQL [`Swipe`](file:///home/parsa/Documents/projects/datemate/backend/prisma/schema.prisma#L399) records. If the unswiped candidate pool reaches 0 (deck exhausted), the feed automatically loops back through the candidate pool excluding only the user themselves so the user can continue viewing candidates.
  3. **Account Status**: `bannedUntil IS NULL` (user is not banned or suspended).
  4. **Has Photo**: Candidate must possess an active profile picture (prioritizing the `gallery` item with `isProfilePicture: true`, falling back to first gallery photo, `profile.profilePictureUrl`, or `profile.avatarUrl`). The feed candidate `profilePicture` field provides the resolved public URL of the gallery image marked with `isProfilePicture: true`.
  5. **Profile Validated**: Candidate has `profileValidated == true` (strictly checks `User.profileValidated == true`; does NOT require an existing `selfieUrl`).
  6. **Gender Matching**: Strictly serves the opposite gender (if user is `MALE`, sends `FEMALE`; if `FEMALE`, sends `MALE`).

### 9.2 API Endpoints
- `POST /v1/swipes` (and `/swipes`): Records swipe action (`RIGHT` or `LEFT`) on a target user. Returns fast 200 OK without extra payload.
- `GET /v1/feed` (and `/feed`): Retrieves candidate profiles for the swipe deck (supports query parameter `limit`, default: 20, max: 50).
- `GET /v1/likes` (and `/likes`): Retrieves all profiles that swiped right (liked) on the authenticated user. Returns `id`, `fullName`, `username`, `city`, `isOnline`, `avatarUrl`:
  ```json
  {
    "status": "success",
    "message": "Likes retrieved successfully",
    "data": [
      {
        "id": 205,
        "fullName": "Sara Connor",
        "username": "sarah_c",
        "city": "Tehran",
        "isOnline": true,
        "avatarUrl": "http://localhost:3000/assets/gallery/profile_pic.webp"
      }
    ]
  }
  ```
- `GET /v1/matches` (and `/matches`): Canonical compatibility endpoint returning the exact same likes list (`data: LikedUserDto[]`).

---

## 10. Recommended Module (`src/modules/recommended`)

The Recommended module computes personalized, high-compatibility profile recommendations (default: 20 candidates per request) using dynamic similarity scoring without hardcoded lifestyle or question rules.

### 10.1 Hygiene Invariants & Filters
Before scoring, candidates must satisfy the 6 discovery baseline hygiene rules:
1. **Exclude Self**: Candidate `id != currentUserId`.
2. **Exclude Already Swiped (with Backfill Fallback)**: Excludes candidates already swiped (`RIGHT` or `LEFT`) recorded in Redis (`swiped:{userId}`) and PostgreSQL [`Swipe`](file:///home/parsa/Documents/projects/datemate/backend/prisma/schema.prisma) table. If there are not enough unswiped candidates to satisfy the requested `limit`, swiped users are retrieved to backfill remaining slots (unswiped candidates are strictly prioritized first, followed by swiped candidates sorted from highest compatibility score to lowest).
3. **Account Status**: Active account (`bannedUntil IS NULL` or in the past).
4. **Has Active Photo**: Must have a valid, non-empty profile picture (`profilePictureUrl`, `avatarUrl`, or active gallery photo).
5. **Profile Validated**: Candidate has `profileValidated == true` (strictly checks `User.profileValidated == true`; does NOT require an existing `selfieUrl`).
6. **Gender**: Strictly opposite gender (`MALE` $\leftrightarrow$ `FEMALE`).

### 10.2 Modular Architecture & Separated Recommendation Algorithm
To ensure maintainability, readability, and ease of modification, the recommendation module decomposes responsibilities strictly following DDD and Clean Architecture:
- **`RecommendationAlgorithmService`** (`src/modules/recommended/domain/services/recommendation-algorithm.service.ts`):
  Pure, decoupled domain service containing the scoring formulas, weight definitions (`DEFAULT_RECOMMENDATION_WEIGHTS`), hygiene photo/validation checks, and multi-factor ranking. It is isolated from database and network infrastructure for easy inspection and algorithm adjustments.
- **`RecommendedCacheService`** (`src/modules/recommended/application/services/recommended-cache.service.ts`):
  Manages candidate list persistence in Redis (`recommended:ranked:{userId}`) with a 1-day TTL read directly from the environment (`RECOMMENDED_CACHE_TTL`, default: `86400` seconds). The cached candidate ranking persists consistently across consecutive client requests and automatically refreshes daily to account for changing user interests or newly joined users.
- **`GetRecommendedUseCase`** (`src/modules/recommended/application/use-cases/get-recommended.use-case.ts`):
  Retrieves lightweight cards (`id`, `avatarUrl`, `age`, `city`, `username`, `fullName`) with numeric pagination (`start`, `limit`, `end`, `offset`).
- **`GetRecommendedDetailUseCase`** (`src/modules/recommended/application/use-cases/get-recommended-detail.use-case.ts`):
  Retrieves full candidate profiles matching the Android `/me` canonical schema (`ProfileResponseDto`), preserving the exact recommendation order from the 1-day Redis cache.

### 10.3 Dynamic Compatibility Scoring Algorithm
Candidates are ranked in descending order of a multi-factor compatibility score ($0 \dots 100$):
1. **Dynamic Lifestyle & Personality Questions (Weight: up to 35 pts)**:
   - Evaluates shared question answers from [`UserQuestionAnswer`](file:///home/parsa/Documents/projects/datemate/backend/prisma/schema.prisma) across all dynamic question types (`LIFESTYLE`, `PERSONALITY`, `VALUES`, `PREFERENCES`).
   - Zero hardcoding of question texts or IDs; computed as the ratio of overlapping answers to total answered questions.
2. **Shared Interests (Weight: up to 25 pts)**:
   - Evaluates overlap across user interest tags ([`UserInterest`](file:///home/parsa/Documents/projects/datemate/backend/prisma/schema.prisma)).
3. **Same City Proximity (Weight: 20 pts)**:
   - $+20$ points when candidate's `cityId` matches current user's `cityId`.
4. **Relationship Goal Alignment (Weight: 10 pts)**:
   - $+10$ points when candidate's [`Preferences.relation`](file:///home/parsa/Documents/projects/datemate/backend/prisma/schema.prisma) matches user's relationship goal (`LONG`, `FUN`, `OPEN`).
5. **Age Proximity (Weight: up to 10 pts)**:
   - Evaluates age difference: $\le 3$ years: $+10$ pts; $\le 6$ years: $+6$ pts; $\le 10$ years: $+3$ pts.

Ranking order:
- Unswiped candidates appear first; swiped fallback candidates appear second.
- Within each tier, candidates sort in descending order of compatibility score (from highest match to lowest filter/match).
- Tie-breakers sort by user activity (`isOnline` descending), recent presence (`lastSeenAt` descending), and user ID.

### 10.4 API Endpoints

#### 1. Lightweight Discovery Cards: `GET /v1/recommended`
- **Query Params**:
  - `start` / `offset` (default: 0): Starting numeric index (0-based) OR candidate user ID cursor to start from/after.
  - `candidateId` (optional): Explicit candidate user ID cursor to start from/after.
  - `limit` (default: 20, min: 1, max: 50): Number of profile cards to retrieve.
  - `end` (optional): Ending numeric index.
  - `anchorUserId` (optional): Anchor candidate user ID around which to retrieve preceding and succeeding candidates.
  - `before` (optional, min: 0, max: 50): Number of candidates preceding the anchor.
  - `after` (optional, min: 0, max: 50): Number of candidates succeeding the anchor.
- **Caching**: 1-day Redis cache (`recommended:ranked:{userId}`). Does not regenerate automatically while cache is active; only generates and saves on first request or when cache expires.
- **Auth**: Requires Bearer JWT token (`UserAuthGuard`).
- **Response Payload**: Returns lightweight cards:
  ```json
  {
    "status": "success",
    "message": "Recommended profiles retrieved successfully",
    "data": [
      {
        "id": 102,
        "avatarUrl": "http://localhost:3000/assets/avatars/avatar_102.webp",
        "age": 25,
        "city": "Tehran",
        "username": "sarah_c",
        "fullName": "Sara Connor"
      }
    ]
  }
  ```

#### 2. Full Profile Details: `GET /v1/recommended/detail`
- **Query Params**:
  - `start` / `offset` (default: 0): Starting numeric index (0-based) OR candidate user ID cursor to start from/after.
  - `candidateId` (optional): Explicit candidate user ID cursor to start from/after.
  - `limit` (default: 20, min: 1, max: 50): Number of detailed profiles to retrieve.
  - `end` (optional): Ending numeric index.
  - `anchorUserId` (optional): Anchor candidate user ID around which to retrieve preceding and succeeding candidates (e.g. `anchorUserId=123&before=10&after=10`).
  - `before` (optional, min: 0, max: 50): Number of candidates preceding the anchor.
  - `after` (optional, min: 0, max: 50): Number of candidates succeeding the anchor.
- **Auth**: Requires Bearer JWT token (`UserAuthGuard`).
- **Response Payload**: Returns full `/me` detailed profile objects:
  ```json
  {
    "status": "success",
    "message": "Recommended detailed profiles retrieved successfully",
    "data": [
      {
        "id": 102,
        "email": "sarah@example.com",
        "language": "EN",
        "lat": 35.6892,
        "lon": 51.389,
        "profileValidated": true,
        "isPremium": false,
        "Profile": {
          "fullName": "Sara Connor",
          "username": "sarah_c",
          "phoneNumber": "+1234567890",
          "bio": "Designer in Tehran",
          "languages": ["en", "fa"],
          "avatar": "http://localhost:3000/assets/avatars/avatar_102.webp",
          "profilePicture": "http://localhost:3000/assets/avatars/avatar_102.webp",
          "profilePictureId": 5,
          "profileCompleted": true,
          "isPremium": false,
          "Demographic": {
            "birthDate": "1998-01-01",
            "gender": "FEMALE",
            "height": 168,
            "degree": "BACHELOR",
            "profession": "Designer",
            "relationStatus": "SINGLE",
            "City": {
              "id": 1,
              "name": "Tehran",
              "state": "Tehran",
              "country": "Iran"
            }
          },
          "RelationType": "LONG",
          "Answers": { "1": 0, "2": 1 },
          "LikedActivities": { "1": [1, 2] }
        },
        "gallery": [
          {
            "id": 5,
            "url": "http://localhost:3000/assets/images/gallery_5.webp",
            "description": "At the design studio",
            "isProfilePicture": true,
            "createdAt": "2026-10-04T12:00:00.000Z"
          }
        ]
      }
    ]
  }
  ```

---

## 11. Global Rate Limiting & Proxy Security

### 11.1 Architecture & Core Configuration
Rate limiting is globally enforced using the official `@nestjs/throttler` package integrated at the root module level (`src/app.module.ts`) via `APP_GUARD` and `ThrottlerGuard`.

- **Global Threshold**: **120 requests per IP per 60 seconds** (configurable via `THROTTLE_LIMIT` and `THROTTLE_TTL`).
- **Response On Limit Exceeded**: Returns HTTP `429 Too Many Requests` formatted cleanly through `AllExceptionsFilter`:
  ```json
  {
    "status": "error",
    "message": "Too Many Requests",
    "data": null,
    "error": {
      "type": "UNKNOWN_ERROR",
      "message": "Too Many Requests"
    }
  }
  ```
- **Standard Headers**: Rate-limiting response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`) are returned to enable client-side backoff calculation.
- **Monitoring / Health Exemption**: Health check endpoints (`GET /health` and `GET /`) are decorated with `@SkipThrottle()` to prevent container orchestrators (Docker, Kubernetes) and monitoring systems from being inadvertently throttled.

### 11.2 Reverse Proxy & Client IP Verification (Anti-Spoofing)
DateMate operates behind Nginx (configured in `docker-compose.yml` and `nginx/nginx.conf` terminating SSL and forwarding traffic to `127.0.0.1:2020`).

- **The Threat**: Attackers can send arbitrary `X-Forwarded-For` or `X-Real-IP` request headers from the client to attempt bypassing IP-based rate limiting or to cause denial-of-service against other users.
- **The Defense**:
  - Express is explicitly configured with `app.set('trust proxy', 'loopback')` in `src/main.ts`.
  - When `trust proxy` is set to `'loopback'` (or `1`), Express **only trusts the immediate reverse proxy hop** if the connection originates from a loopback address (`127.0.0.1` / `::1`).
  - Express evaluates `X-Forwarded-For` from right to left, peeling off the trusted loopback hop and selecting the first untrusted IP (the genuine client IP appended by Nginx's `$proxy_add_x_forwarded_for`). Any spoofed IP addresses prepended by malicious clients are discarded.
  - If a client connects directly to the backend bypassing Nginx, the incoming connection socket address is not loopback; Express automatically rejects all forwarded headers and uses the raw TCP socket address (`req.socket.remoteAddress`).

### 11.3 Endpoint-Specific Sensitive Route Limits
To defend against brute-force credential stuffing, OTP guessing, and email-bombing attacks, strict limits are declared using `@Throttle()` in `src/modules/auth/presentation/auth.controller.ts`:

| Endpoint | Method | Limit | TTL | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `/v1/auth/signin` | `POST` | 10 reqs | 60s | Mitigates credential stuffing and password brute-force attacks |
| `/v1/auth/signup` | `POST` | 10 reqs | 60s | Prevents automated registration spam and email inbox flooding |
| `/v1/auth/verify` | `POST` | 10 reqs | 60s | Stops brute-forcing 6-digit OTP verification codes (10m lifespan) |
| `/v1/auth/forgot-password` | `POST` | 5 reqs | 60s | Thwarts OTP spam and email exhaustion attacks against target accounts |
| `/v1/auth/reset-password` | `POST` | 10 reqs | 60s | Prevents rapid brute-force execution of password resets |

### 11.4 Scalability & Distributed Storage Considerations
- **Current Storage Model**: The default `@nestjs/throttler` storage uses high-performance in-memory storage (`ThrottlerStorageService`).
- **Single-Instance Suitability**: In single-instance deployments, in-memory rate limiting delivers minimal latency and zero extra infrastructure dependencies.
- **Multi-Instance / Clustered Limitations**:
  - In horizontal scale-out scenarios where multiple DateMate backend instances run behind a load balancer, each instance maintains an isolated in-memory counter table.
  - Consequently, client request capacity would multiply across $N$ instances ($N \times 120$ requests/min).
  - Additionally, instance restarts (e.g., rolling deployments or auto-scaling events) clear in-memory hit counts.
- **Recommendation for Distributed Deployments**:
  - When running multiple backend instances, configure shared distributed storage using DateMate's existing Redis cluster (`ioredis`).
  - `@nestjs/throttler` provides pluggable storage support via `@nestjs/throttler-storage-redis` or custom `ThrottlerStorage` implementing `increment()`, pointing to the existing `REDIS_HOST` and `REDIS_PORT` service defined in `src/infrastructure/redis/redis.module.ts`.

### 11.5 Nginx Edge Rate Limiting & Sensitive Path Protection
Nginx serves as the primary edge reverse proxy terminating TLS and protecting the backend from automated vulnerability scanning and DDoS floods before traffic ever reaches NestJS.

- **Dual-Layer Defense-in-Depth**:
  - **Layer 1 (Nginx)**: Absorbs high-volume L7 traffic spikes and rapid scanner bursts at the network edge with minimal CPU overhead.
  - **Layer 2 (NestJS @nestjs/throttler)**: Enforces business-aware rate limiting, rolling session quotas, and endpoint-specific thresholds (such as 5–10 attempts/min on auth routes).
- **Shared Memory Zone (`api_limit`)**:
  - Configured at the top-level `http` block: `limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;`.
  - A 10 MB zone efficiently holds approximately 160,000 concurrent client IP states in binary format.
- **Enforcement & Burst Handling**:
  - Applied to the API proxy location: `limit_req zone=api_limit burst=30 nodelay;`.
  - Legitimate bursts of up to 30 requests are serviced immediately without artificial delays (`nodelay`).
  - Excess requests immediately trigger rejection status `limit_req_status 429;`.
- **Unified 429 Error Envelope**:
  - An internal Nginx handler (`error_page 429 = @rate_limited;`) outputs a unified JSON response matching the application's standard error format:
    ```json
    {"status":"error","message":"Too Many Requests","data":null,"error":{"type":"UNKNOWN_ERROR","message":"Too Many Requests"}}
    ```
- **Sensitive Path Probing Denial**:
  - Requests targeting common automated scanner patterns (`/ssh/`, `/keys/`, `/id_rsa`, `/id_ed25519`, `/private_key.pem`, and hidden credentials) are intercepted and dropped with HTTP 404 at the Nginx edge without forwarding to upstream services:
    ```nginx
    location ~* (/(?:\.?ssh|\.?keys)(?:/|$)|id_rsa|id_ed25519|private_key\.pem) {
        return 404;
    }
    ```
- **Anti-Spoofing Client Identifier**:
  - Rate limiting strictly indexes `$binary_remote_addr` (the actual IP from the TCP connection). Nginx does not trust client-supplied `X-Forwarded-For` or `X-Real-IP` headers, preventing attackers from bypassing edge rate limits via spoofed header injection.




