---
name: backend-clean-architecture
description: >-
  Enforce Clean Architecture, DDD, Modular Monolith, SOLID principles, mandatory tests on feature addition/updates, and documentation sync when developing DateMate backend.
---

# Backend Architecture Guidelines

## 1. Clean Architecture + Domain-Driven Design (DDD) + Modular Monolith
- **Modular Monolith**: Structure code around bounded contexts (e.g. `auth`, `users`, `matching`, `chat`, `events`, `payments`).
- **DDD**: Domain entities & business rules stay pure with zero external dependencies.
- **Key Benefits**:
  - Low coupling
  - Easy testing
  - Easy feature addition
  - Ability to split into microservices later

## 2. SOLID Principles
- **SRP**: Keep Controllers, Services, and Repositories strictly separated.
- **OCP**: Use interfaces/strategies so new features can be added without modifying existing code.
- **LSP**: Adhere strictly to interface contracts.
- **ISP**: Small, role-specific interfaces instead of bloated god-interfaces.
- **DIP**: Always inject abstractions/interfaces (never instantiate DB/cache directly in domain logic).

## 3. Extensibility & Ease of Change
- **Loose Coupling**: Decouple domain logic from transport (HTTP/Socket.IO) and persistence (Prisma/Redis).
- **Feature-Ready**: Modules must allow adding or altering features with minimal friction and zero regressions.

## 4. Mandatory Testing
- **Feature Tests**: Always add or update unit/integration tests when creating a new feature or modifying an existing one. Every use case must be covered.

## 5. Keep Documentation Updated
- **Doc Sync**: Whenever code, APIs, schemas, or business logic change, update relevant docs (e.g. `ARCHITECTURE.md`, API specs) to keep them in sync.

## 6. Single Canonical Contract (No Duplicate Fields)
- **Single Contract**: Maintain a single, unambiguous contract for every DTO and endpoint.
- **No Duplication**: Never duplicate fields between root and nested objects. Fields have one single authoritative location (e.g. `profilePictureId` and `gallery` belong strictly outside the `Profile` object at the root level).

## 7. Gallery & Profile Picture Update Rules (`PUT /v1/users/profile` & `POST /v1/users/profile`)
- **Single Image Upload Per Request**: Do NOT allow sending multiple gallery images in a single request. Only one gallery picture is permitted per request (`maxCount: 1`).
- **Gallery Payload as an Object**: In request payloads, `gallery` must be sent as a single object (`{ isProfilePicture?: boolean, description?: string }`), NOT as an array.
- **Default `isProfilePicture`**: The `isProfilePicture` field can be omitted by the client. If not provided, the backend must automatically default `isProfilePicture: true` for the first gallery image upload.
- **Selecting Existing Profile Picture via `profilePictureId`**: To select an existing gallery photo as the active profile picture, the client sends `profilePictureId` (integer ID) at the root level. No `profilePicture` string URL key is needed or accepted in the request.
- **Strictly Outside `Profile`**: Both `gallery` and `profilePictureId` must strictly reside at the root level outside the `Profile` object. Never accept or duplicate them inside `Profile`.

