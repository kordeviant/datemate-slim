# DateMate Backend

Scalable real-time backend service for the DateMate platform. Built with Node.js, NestJS, TypeScript, Socket.IO, PostgreSQL, Redis, and Elasticsearch following Clean Architecture, Domain-Driven Design (DDD), and Modular Monolith principles.

---

## Documentation

- **[Client Rules & Validation Specification (RULES.md)](file:///home/parsa/Documents/projects/datemate/backend/docs/RULES.md)**: **Authoritative rules** for media uploads, username, full name, DOB/age, languages, demographics, and security.
  - *Live Online Endpoint*: [`http://localhost:3000/rules`](http://localhost:3000/rules) or [`http://localhost:3000/v1/rules`](http://localhost:3000/v1/rules) (HTML, JSON, raw Markdown, or download).
- **[REST API Specification & Swagger](file:///home/parsa/Documents/projects/datemate/backend/docs/api/README.md)**: Endpoints, request/response examples, Swagger UI (`/docs`).
- **[MVP Data Model Specification](file:///home/parsa/Documents/projects/datemate/backend/docs/data-model/README.md)**: Clean Architecture & DDD data model, ERD, and Prisma schema.
- **[Deployment & Getting Started](file:///home/parsa/Documents/projects/datemate/backend/docs/deployment/README.md)**: Setup, running locally, and deployment instructions.
- **[Project Resources](file:///home/parsa/Documents/projects/datemate/backend/docs/resources/README.md)**: Git repository, Figma design links, and resources.
- **[System Design (Tinder Model)](file:///home/parsa/Documents/projects/datemate/backend/docs/system-design/FUNDUMENTAL_SYSTEM_DESIGN.md)**: High-scale feed generation, atomic swipe matching, Bloom filter deduplication.
- **[Engineering Rules & Guidelines](file:///home/parsa/Documents/projects/datemate/backend/AGENTS.md)**: SOLID principles, Clean Architecture, and development standards.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start infrastructure services (PostgreSQL, Redis)
docker compose up -d

# 4. Run database migrations
npx prisma migrate dev

# 5. Start development server
npm run start:dev
```
