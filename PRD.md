# Product Requirements Document (PRD) & Backend Architecture Guide

This document serves as the primary reference for AI agents (and developers) when building and maintaining the backend application. All code implementations must adhere to the architectural standards and technology stack defined below.

## 1. Technology & Environment (Tech Stack)
- **Runtime:** [Bun](https://bun.sh/) (Efficient, fast, and modern)
- **Framework:** [Hono](https://hono.dev/) (Use latest stable documentation)
- **Database:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/) (Use latest official documentation)

## 2. Application Architecture (Layered Architecture)
This application must be built using a *Layered Architecture* pattern to maintain separation of concerns, structured with the following standard directory layout:

```text
src/
├── index.ts               # Entry point (Initializes Hono & runs Bun server)
├── db/
│   └── prisma.ts          # ORM configuration (e.g., Prisma client for Postgres)
├── middlewares/
│   ├── auth.ts            # JWT middleware & Role-Based Access Control (RBAC)
│   └── error.ts           # Global error handler
├── routes/
│   └── product.route.ts   # HTTP request/response handling & OpenAPI Endpoints
├── services/
│   └── product.service.ts # Core business logic (Data processing, calculations, transactions)
└── validations/
    └── product.schema.ts  # Request/response validation schemas using Zod
```

### Core Architectural Principles:
1. **Centralized Business Logic Consistency:**
   All complex business logic (such as stock deduction, discount validation, calculations, and RBAC rules) **must reside centrally within the Service Layer**. This logic must be directly reusable whether invoked via HTTP Routes/Controllers or internal background cron jobs without duplication.
2. **Transaction Reliability:**
   Database interactions must remain properly isolated. If a complex transaction fails midway, the Service Layer is responsible for safely executing rollback mechanisms without exposing low-level database error details to the Route (HTTP layer).
3. **Isolated Testability:**
   The Service Layer must consist purely of TypeScript functions that **have no coupling or dependency on Hono request/response context objects**. This guarantees unit tests run quickly, predictably, and independently with mocks.

## 3. Testing Strategy
Testing is a top priority and utilizes **Vitest** paired with **Prisma Mock** (`vitest-mock-extended`) to test business logic quickly without requiring a live database connection or starting a web server.

**Testing Layer Priorities:**
1. **Service Layer (Top Priority):** Mandatory *Unit Tests* verifying that business logic, error conditions, and transactions execute accurately.
2. **Route / Controller Layer:** Focused on *Integration Tests* / *E2E API Tests* verifying request validation, authentication, and HTTP responses.

## 4. Logging System
Application logging is implemented using **Pino** for optimal high-performance structured logging.
- **Middleware Level (Routes):** Mandatory request logging recording incoming/outgoing HTTP requests, HTTP methods, paths, status codes, and response latency.
- **Service Level:** Used to trace critical business flows, record metrics, and capture handled errors cleanly.

## 5. API Endpoints & Versioning
All public API endpoints must follow URL *Versioning* (e.g., `/api/v1`, `/api/v2`).
**Objectives of Versioning:**
- Prevent *Breaking Changes* for existing frontend and mobile clients.
- Protect third-party integrations.
- Enable smooth iteration and evolution of business requirements over time.

**Version Bump Criteria:**
A major version bump of an endpoint is required when introducing breaking changes:
- Adding, altering, or removing mandatory JSON fields in payloads.
- Altering data types (e.g., changing from `String` to `Array`).
- Changing workflow URL structures (e.g., splitting a single `/checkout` process into two distinct sequential endpoints).

## 6. API Documentation (Code-First OpenAPI)
API documentation follows a **Code-First OpenAPI** strategy:
- Request/response data validation using **Zod**.
- OpenAPI specification generation using **`@hono/zod-openapi`**.
- Interactive UI documentation using **Scalar** (lightweight, modern, and officially integrated with Hono).

### 🔒 Documentation Security
API documentation is confidential and **MUST ONLY** be accessible to authorized team members. Documentation does not require database authentication; use Hono's built-in `basicAuth` middleware.

**Documentation Protection Example:**
```typescript
import { basicAuth } from 'hono/basic-auth'
import { apiReference } from '@scalar/hono-api-reference'

// --- PROTECTED AREA FOR API DOCUMENTATION ---
// Apply Basic Auth ONLY to /docs and /openapi.json paths

v1App.use('/docs/*', basicAuth({
  username: process.env.DOCS_USERNAME || 'developer',
  password: process.env.DOCS_PASSWORD || 'dev-team-secret',
}));

v1App.use('/openapi.json', basicAuth({
  username: process.env.DOCS_USERNAME || 'developer',
  password: process.env.DOCS_PASSWORD || 'dev-team-secret',
}));

// 1. Generate OpenAPI Spec (Protected by basicAuth)
v1App.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { title: 'POS API', version: '1.0.0' },
});

// 2. Render Scalar UI (Protected by basicAuth)
v1App.get('/docs', apiReference({
  spec: { url: '/api/v1/openapi.json' },
}));
```

## 7. Language & Documentation Standards (English First)
All documentation, source code, and technical communication within this project **must prioritize English (English First)**. This rule encompasses:
- **Project Documentation:** All technical documentation files (`README.md`, architectural notes, schema references, setup guides) must be written in English.
- **API Documentation (OpenAPI & Scalar):** Endpoint titles, summaries, descriptions, parameter explanations, and schema payload examples must be in English.
- **Source Code & Comments:** Variable names, function names, class/interface definitions, type aliases, directory/file naming, and inline code comments must be in English.
- **API Responses & Error Messages:** HTTP JSON response payloads, Zod validation messages, and error messages returned to clients must be in English.
- **Logging System:** Log statements (Pino), event tracing descriptions, and debugging logs must be recorded in English.
- **Git & Collaboration:** Git commit messages, Pull Request descriptions, issue trackers, and code reviews must be written in English.

---
**⚠️ CRITICAL NOTES FOR AI AGENTS:**
1. Code must always be built with maximum efficiency and security. Avoid unnecessary computational overhead and boilerplate. Think critically and make sound architectural decisions aligned with this guide.
2. **English First:** Every new code artifact, schema, route, validation, log message, error response, and documentation file must consistently use English.
