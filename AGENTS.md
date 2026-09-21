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
