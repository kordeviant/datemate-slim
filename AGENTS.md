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

## 6. Single Canonical Contract (No Duplicate Fields)
- Maintain a single, unambiguous contract for every DTO, API request, and API response.
- Do NOT duplicate fields between parent/root payload structures and nested objects.
- Fields must have one and only one authoritative location in a request. For example, `profilePictureId` and `gallery` belong strictly at the root level outside the `Profile` object in profile update requests. Never duplicate or accept them in multiple locations.

## 7. Gallery & Profile Picture Update Rules (`PUT /v1/users/profile` & `POST /v1/users/profile`)
- **Single Image Upload Per Request**: Do NOT allow sending multiple gallery images in a single request. Only one gallery picture is permitted per request (`maxCount: 1`).
- **Gallery Payload as an Object**: In request payloads, `gallery` must be sent as a single object (`{ isProfilePicture?: boolean, description?: string }`), NOT as an array.
- **Default `isProfilePicture`**: The `isProfilePicture` field can be omitted by the client. If not provided, the backend must automatically default `isProfilePicture: true` for the first gallery image upload.
- **Selecting Existing Profile Picture via `profilePictureId`**: To select an existing gallery photo as the active profile picture, the client sends `profilePictureId` (integer ID) at the root level. No `profilePicture` string URL key is needed or accepted in the request.
- **Strictly Outside `Profile`**: Both `gallery` and `profilePictureId` must strictly reside at the root level outside the `Profile` object. Never accept or duplicate them inside `Profile`.

