# Backend Core Guidelines

## 1. Architecture Paradigm: Clean Architecture + DDD + Modular Monolith
- **Modular Monolith**: Group code by bounded contexts / business domains (e.g. `auth`, `users`, `matching`, `chat`, `events`, `payments`).
- **Domain-Driven Design (DDD)**: Keep pure domain models, business logic, and invariants isolated from infrastructure.
- **Benefits**:
  - Low coupling & high cohesion
  - Easy unit & integration testing
  - Easy feature addition without side effects
  - Effortless split into independent microservices later if scale demands

## 2. SOLID Principles
- **S (Single Responsibility)**: Keep Controllers, Services, and Repositories strictly separated.
- **O (Open/Closed)**: Use interfaces and strategy patterns for easy extension without modifying existing code.
- **L (Liskov Substitution)**: Implementations must honor their interface contracts.
- **I (Interface Segregation)**: Create small, focused interfaces rather than large god-interfaces.
- **D (Dependency Inversion)**: Always depend on abstractions/interfaces; inject dependencies (never instantiate DB/cache directly in domain logic).

## 3. Extensibility & Ease of Change
- Design every module so adding or modifying a feature requires minimal friction and zero breaking changes to existing components.
- Keep business logic decoupled from infrastructure (Prisma, Redis, Socket.IO, HTTP).
- Use DTOs, domain events, and modular services to ensure loose coupling.

## 4. Mandatory Testing
- **Test-Driven / Verified**: Always add or update unit and integration tests whenever adding a new feature or modifying an existing one.
- Every use case must have corresponding test coverage to prevent regressions and verify edge cases.

## 5. Keep Documentation Updated
- Whenever code, APIs, schemas, or business logic change, immediately update the relevant documentation (e.g. `ARCHITECTURE.md`, API specs, and schemas) to stay in sync.

## 6. Single Canonical Contract (No Duplicate Fields & No Field Aliases)
- Maintain a single, unambiguous contract for every DTO, API request, and API response.
- Do NOT duplicate fields between parent/root payload structures and nested objects.
- Fields must have one and only one authoritative location in a request and response. For example, `profilePictureId` and `gallery` belong strictly at the root level outside the `Profile` object in profile update requests. Never duplicate or accept them in multiple locations.
- **Strictly Forbid Redundant Field Aliases (`City`, `city`, `cityName`, `citiName`, etc.)**:
  - Never add artificial alias fields (`City`, `city`, `cityName`, `citiName`, etc.) to DTOs, requests, or response payloads.
  - Responses must strictly match their canonical schema:
    - In user profile responses (`GET /v1/users/profile`, `PUT /v1/users/profile`), city details reside exclusively at `Profile.Demographic.City` (`CityResponseDto` containing `id`, `name`, and nested `State: { id, name, Country }`). Never add alias properties such as `city`, `cityName`, or duplicate `City` at the `Profile` or root response level.
    - In candidate DTOs (Feed `FeedCandidateDto`, Recommended `RecommendedCandidateDto`, Likes `LikedUserDto`), the city string field is canonically `city: string | null`. Never add `cityName`, `City`, `Profile`, or other aliases to these flat DTOs.
  - Always fix the root cause (data resolution, schema mapping, foreign key constraints, or service lookup) rather than polluting API contracts with fallback aliases.

## 7. Gallery & Profile Picture Update Rules (`PUT /v1/users/profile` & `POST /v1/users/profile`)
- **Single Image Upload Per Request**: Do NOT allow sending multiple gallery images in a single request. Only one gallery picture is permitted per request (`maxCount: 1`).
- **Gallery Payload as an Object**: In request payloads, `gallery` must be sent as a single object (`{ isProfilePicture?: boolean, description?: string }`), NOT as an array.
- **Default `isProfilePicture`**: The `isProfilePicture` field can be omitted by the client. If not provided, the backend must automatically default `isProfilePicture: true` for the first gallery image upload.
- **Updating Existing Gallery Image by ID**: When both a gallery image file and `gallery.id` (or `id`) are provided in a request, the backend replaces the existing gallery item's image file and description with the new uploaded image instead of creating a new gallery item.
- **Selecting Existing Profile Picture via `profilePictureId`**: To select an existing gallery photo as the active profile picture, the client sends `profilePictureId` (integer ID) at the root level. No `profilePicture` string URL key is needed or accepted in the request.
- **Deleting Gallery Image by ID**: Authenticated users can delete an individual gallery photo via `DELETE /v1/users/gallery/:galleryId`. If the deleted photo was the active profile picture, the backend automatically falls back to another existing gallery photo or clears `profilePictureUrl`.
- **No `likesCount` in Gallery Response**: Gallery response objects returned to clients (`gallery`) do NOT include `likesCount`.
- **Strictly Outside `Profile`**: Both `gallery` and `profilePictureId` must strictly reside at the root level outside the `Profile` object. Never accept or duplicate them inside `Profile`.

## 8. No Route Aliases for APIs
- Do NOT add aliases for APIs (e.g. do NOT register multiple route paths like `['gallery/:galleryId', 'me/gallery/:galleryId']` for the same endpoint).
- Route aliases confuse client usage. Maintain one and only one canonical, unambiguous route per endpoint.

## 9. Commit & Push Policy
- **Never Commit or Push Automatically**: Do NOT run `git commit` or `git push` unless the user explicitly instructs to commit or push. Always keep changes in the working directory and wait for the user to explicitly request a commit/push.

## 10. Feed & Recommended Discovery Invariants (`profileValidated` vs `selfieUrl`)
- For candidate discovery in both Feed (`GET /v1/feed`) and Recommended (`GET /v1/recommended`), strictly enforce `User.profileValidated == true`.
- Do NOT check or require an existing `selfieUrl` on candidate profiles. Users with `profileValidated == true` must be eligible regardless of whether `selfieUrl` is present or null.

## 11. Device Token & Device Info Invariants (`PUT /v1/users/device-token` & `GET /v1/users/:userId/device-token`)
- **Single Canonical Field Names**:
  - Push notification token field is strictly and exclusively `token`.
  - Device information field is strictly and exclusively `deviceInfo`.
  - Never add alias fields (`fcmToken`, `deviceToken`, `device_token`, `fcm_token`, `Token`, `DeviceInfo`, etc.) to DTOs, request bodies, or responses.
- **Canonical Endpoints**:
  - `PUT /v1/users/device-token`: Updates the authenticated session's device token and deviceInfo (requires user JWT).
  - `GET /v1/users/:userId/device-token`: Retrieves active token and deviceInfo by user ID (authenticated strictly via API key in `x-api-key` header / `ApiKey` auth, NOT user JWT).

