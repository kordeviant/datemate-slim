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
