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
- Keep business logic decoupled from infrastructure (PostgreSQL/pgx/sqlc, Redis, Socket.IO, HTTP).
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

### Git Workflow & Commit Guidelines

To maintain a clean, consistent, and traceable Git history, all developers must follow these rules:

#### 1. Branch Management
- Do not push directly to the `develop` branch.
- All changes must be developed on a dedicated feature, bugfix, or hotfix branch.
- Push changes only to your own working branch.
- Changes must be integrated into `develop` through a Merge Request (MR).
- All Merge Requests must be reviewed and approved before merging.

#### 2. Hotfix Workflow
- Hotfix branches are intended for critical issues that require immediate fixes.
- Create a dedicated `hotfix` branch for urgent production issues.
- Hotfixes should be prioritized and addressed immediately.
- Submit a Merge Request as soon as the fix is ready.
- Hotfixes must still follow the code review and approval process.
- After merging, ensure the fix is also applied to other relevant branches (such as `develop`) to prevent the issue from reoccurring.

**Branch naming examples:**
- `feature/add-user-authentication`
- `bugfix/fix-email-validation`
- `hotfix/fix-payment-failure`

#### 3. Commit Message Convention
- Follow the Conventional Commits standard for every commit.
- Each commit must represent one logical change (Atomic Commit).
- Commit messages must be clear, concise, and meaningful.
- Use the appropriate commit type:
  - `feat`: New feature
  - `fix`: Bug fix
  - `hotfix`: Urgent production fix
  - `refactor`: Code restructuring
  - `docs`: Documentation changes
  - `test`: Test-related changes
  - `chore`: Maintenance tasks

**Commit message format:**

`<type>(<scope>): <description>`

**Examples:**
- `feat(auth): add JWT authentication`
- `fix(user): resolve email validation issue`
- `hotfix(payment): resolve payment processing failure`
- `refactor(api): simplify response handling`
- `docs(readme): update installation instructions`

#### 4. General Rules
- Keep commits focused on a single logical change.
- Avoid vague commit messages such as `update`, `changes`, or `fix`.
- Review your changes before committing and pushing.
- Keep your feature or hotfix branch up to date with the relevant target branch.

**Important:** Direct pushes to `develop` are not allowed. All changes must go through the Merge Request process.

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

