# Design: backend-testing-pipeline

## 1. Overview

This change establishes the integration testing layer, CI/CD gating, and environment documentation for the remision-manager-backend project. It adds:

1. **Integration tests** for core HTTP middleware (`authenticate`, `authorize`, `errorHandler`, `rateLimiter`) and at least one end-to-end request lifecycle test spanning registration → login → protected resource access.
2. **GitHub Actions CI workflow** that runs typecheck → lint → test → build on every PR and on pushes to `main`.
3. **`.env.example`** documenting every required and optional environment variable.
4. **OpenSpec metadata update** declaring integration test capability.

All integration tests use **supertest** for HTTP-level assertions and **mongodb-memory-server** for an isolated in-memory MongoDB instance. Tests are executed by the existing `bun:test` runner via `bun test`.

> **Assumption**: `backend-database-stability` has already landed, removing the lazy `dbReady` middleware from `server.ts`. Integration tests assume `createServer()` returns an Express application that does **not** auto-connect to MongoDB on the first request.

---

## 2. Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| E2E test runner | **supertest** | Familiar Express integration test harness; supports all HTTP methods, headers, and body assertions without binding to a network port. The parent explicitly selected this over native Bun `Request`. |
| In-memory database | **mongodb-memory-server** | Provides a real MongoDB instance for Mongoose without requiring external infrastructure. Bun is Node-compatible; downloads are cached by GitHub Actions. |
| Integration test location | Co-located middleware tests in `src/` + shared infra & E2E in `src/tests/integration/` | Follows the existing co-location convention (`*.test.ts` next to source) for middleware tests. Cross-cutting E2E tests and shared helpers live in `src/tests/integration/` so they remain inside `tsconfig.json`'s `include` (`src/**/*.ts`). |
| Env var injection for tests | Module-level `process.env` assignment in `src/tests/integration/setup.ts` | `src/config/env.ts` eagerly validates `process.env` at module load time via `import "dotenv/config"`. Setting `process.env` in a shared setup module — imported as the **first** line of every integration test file — guarantees `env.ts` sees test-safe values before it is ever evaluated. |
| Rate limiter testability | Add `createGeneralLimiter(windowMs, limit)` factory to `rateLimiter.ts` | The production rate limit defaults to 300 requests / 15 min. Testing 429 behavior in CI requires a much lower limit. A factory lets the integration test verify the real middleware wiring with a 2-request / 1-second limit without mutating global state or env vars. |
| CI trigger rules | All PRs + pushes to `main` only | Matches the spec requirement. Direct pushes to feature branches do not trigger CI, avoiding redundant runs when a PR already exists. |
| Test script | Continue using `bun test` | The existing script discovers all `**/*.test.ts` files. No new script is required for CI; a `test:integration` convenience script may be added to `package.json` but is not mandatory. |
| CI test env vars | None required in workflow YAML | `src/tests/integration/setup.ts` sets all required `process.env` values (JWT secrets, MongoDB URI placeholder, CORS origins, rate limits). This keeps the workflow file generic and avoids duplicating secrets. |

---

## 3. File Inventory

### New Files

| File | Purpose |
|------|---------|
| `.env.example` | Complete environment variable template with inline comments |
| `.github/workflows/ci.yml` | GitHub Actions workflow (Bun, fail-fast, 4 steps) |
| `src/tests/integration/setup.ts` | In-memory DB lifecycle (start/stop/clean) + env bootstrap |
| `src/tests/integration/helpers/auth.ts` | `generateAccessToken()` and `generateAuthHeader()` helpers |
| `src/tests/integration/e2e/auth-lifecycle.test.ts` | E2E: register → login → access protected endpoint |
| `src/presentation/http/middlewares/authenticate.test.ts` | Integration tests for JWT authentication middleware |
| `src/presentation/http/middlewares/authorize.test.ts` | Integration tests for role-based authorization middleware |
| `src/presentation/http/middlewares/errorHandler.test.ts` | Integration tests for structured error responses |
| `src/presentation/http/middlewares/rateLimiter.test.ts` | Integration tests for rate-limit blocking (429) |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `mongodb-memory-server` and `supertest` to `devDependencies`; optionally add `test:integration` script |
| `src/presentation/http/middlewares/rateLimiter.ts` | Export `createGeneralLimiter(windowMs, limit)` factory; keep existing `generalLimiter` and `authLimiter` constants |
| `openspec/config.yaml` | Set `testing.projects[0].test_layers.integration: true` |
| `README.md` | Add explicit warning not to commit `.env`; add guidance on generating JWT secrets |

---

## 4. Capability 1: Integration Testing

### 4.1 Test Directory Layout

```
src/
├── tests/
│   └── integration/
│       ├── setup.ts              # Env bootstrap + MongoMemoryServer lifecycle
│       ├── helpers/
│       │   └── auth.ts           # JWT token construction for test requests
│       └── e2e/
│           └── auth-lifecycle.test.ts
└── presentation/http/middlewares/
    ├── authenticate.test.ts
    ├── authorize.test.ts
    ├── errorHandler.test.ts
    └── rateLimiter.test.ts
```

**Rationale**: Middleware integration tests are co-located with the source they verify, matching the existing unit-test convention. Shared infrastructure and E2E tests live under `src/tests/integration/` so TypeScript (`tsc --noEmit`) and Biome both see them.

### 4.2 In-Memory Database Lifecycle (`src/tests/integration/setup.ts`)

**Module-level env bootstrap** (executed on first import):

```typescript
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "integration-test-jwt-access-secret-32";
process.env.JWT_REFRESH_SECRET = "integration-test-jwt-refresh-secret-32";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.RATE_LIMIT_WINDOW_MS = "900000";
process.env.RATE_LIMIT_MAX = "300";
```

**Exported functions**:

- `startTestDatabase()` — Creates a `MongoMemoryServer` instance, writes its URI to `process.env.MONGO_URI`, then dynamically imports `src/infrastructure/database/mongoose.ts` and calls `connectDatabase()`. Uses a singleton (`mongod`) so the DB starts at most once per test process.
- `stopTestDatabase()` — Disconnects Mongoose and stops the memory server.
- `cleanDatabase()` — Iterates over `mongoose.models` and calls `deleteMany({})` on each model, ensuring every test begins with an empty database while preserving indexes and schemas.

**Why dynamic imports?** `connectDatabase()` and `createServer()` transitively import `src/config/env.ts`. Dynamic imports are deferred until `startTestDatabase()` runs, guaranteeing `process.env` is fully populated before `env.ts` evaluates.

### 4.3 Auth & Request Helpers (`src/tests/integration/helpers/auth.ts`)

```typescript
import { JwtService } from "../../../infrastructure/security/jwt.service.js";

export function generateAccessToken(userId: string, role: "admin" | "user"): string {
  return JwtService.signAccessToken({ sub: userId, role });
}

export function generateAuthHeader(userId: string, role: "admin" | "user"): string {
  return `Bearer ${generateAccessToken(userId, role)}`;
}
```

**Import rule**: Every integration test file MUST import `src/tests/integration/setup.ts` **before** importing `auth.ts` (or any other module that transitively loads `env.ts`).

### 4.4 Middleware Integration Tests

All four middleware test files follow the same lifecycle pattern:

1. Statically import `src/tests/integration/setup.ts` as the first import.
2. In `beforeAll`: call `startTestDatabase()`, then dynamically import `createServer()` from `../../server.js`.
3. In `beforeEach`: call `cleanDatabase()`.
4. In `afterAll`: call `stopTestDatabase()`.
5. Use `supertest(app)` to issue requests and assert on status, headers, and body.

#### `authenticate.test.ts`

| Scenario | Route / Request | Expected |
|----------|-----------------|----------|
| Missing token | `GET /api/users/me` (no `Authorization`) | `401`, `success: false`, auth failure message |
| Invalid token | `GET /api/users/me` with `Bearer invalid-token` | `401`, `success: false`, invalid/expired message |
| Valid token | `GET /api/users/me` with `Bearer <valid>` | `200` (verifies middleware attaches `req.user`) |

#### `authorize.test.ts`

| Scenario | Route / Request | Expected |
|----------|-----------------|----------|
| Insufficient role | `GET /api/users` (admin-only) with `user` role token | `403`, `success: false`, authorization failure message |
| Sufficient role | `GET /api/users` with `admin` role token | `200` |

#### `errorHandler.test.ts`

Uses the full `createServer()` app with two dynamically added test routes injected **after** `createServer()` returns but **before** assertions begin:

```typescript
app.get("/test/app-error", () => { throw new NotFoundError("Resource not found"); });
app.get("/test/native-error", () => { throw new Error("Unexpected"); });
```

| Scenario | Route | Expected |
|----------|-------|----------|
| AppError subclass | `GET /test/app-error` | `404`, `success: false`, error message |
| Native Error | `GET /test/native-error` | `500`, `success: false`, generic server message |

#### `rateLimiter.test.ts`

Uses a **standalone mini Express app** (not the full server) to avoid interfering with other tests:

```typescript
const app = express();
app.use(createGeneralLimiter(1000, 2)); // 2 requests per 1 second
app.get("/test", (_req, res) => res.json({ success: true }));
```

| Scenario | Action | Expected |
|----------|--------|----------|
| Within limit | 2 × `GET /test` | `200` |
| Exceeds limit | 3rd `GET /test` | `429`, `success: false`, rate-limit message |

**Rationale**: The production limiter (300 req / 15 min) is impractical to exhaust in a test. The factory function verifies the real rate-limit middleware logic with a tightened window, while the full-server tests for other middleware confirm that `generalLimiter` is wired correctly in `server.ts`.

### 4.5 E2E Auth Lifecycle Test (`src/tests/integration/e2e/auth-lifecycle.test.ts`)

**Prerequisite**: Imports `setup.ts` first, then starts the DB and creates the full Express app in `beforeAll`.

**Scenario A — Happy path**:
1. `POST /api/auth/register` with `{ name, email, password }` → `201`
2. `POST /api/auth/login` with `{ email, password }` → `200`, extract `accessToken`
3. `GET /api/users/me` with `Authorization: Bearer <accessToken>` → `200`, body contains the registered user's `email`

**Scenario B — Missing token after login**:
1. Register and login (same as above).
2. `GET /api/users/me` **without** `Authorization` → `401`

**Database hygiene**: `cleanDatabase()` runs in `beforeEach` so user state never leaks between scenarios.

---

## 5. Capability 2: CI/CD Pipeline

### Workflow File: `.github/workflows/ci.yml`

**Triggers**:
```yaml
on:
  pull_request:
  push:
    branches: [main]
```

**Job structure**:
- `runs-on: ubuntu-latest`
- Setup: `oven-sh/setup-bun@v2` (Bun 1.x)
- Install: `bun install --frozen-lockfile`
- Steps (fail-fast, sequential):
  1. `bun run typecheck` (`tsc --noEmit`)
  2. `bun run lint` (`biome check .`)
  3. `bun test` (unit + integration)
  4. `bun run build` (`tsc --noEmit` — redundant with typecheck but preserves the existing pre-commit sequence)

**Caching**:
- `actions/cache` for `~/.bun/install/cache`
- `actions/cache` for `~/.cache/mongodb-memory-server/` (speeds up `mongodb-memory-server` binary downloads across runs)

**Environment variables**: No repository secrets or workflow env vars are required because `src/tests/integration/setup.ts` sets all test-time `process.env` values internally.

---

## 6. Capability 3: Environment Documentation

### `.env.example`

Lists every variable referenced in `src/config/env.ts`, with inline comments indicating required vs optional status, purpose, and format:

```env
# Required / Optional — purpose
NODE_ENV=development          # Optional: development | production | test (default: development)
PORT=3000                     # Optional: HTTP port (default: 3000)

MONGO_URI=                    # Required: MongoDB connection string

JWT_ACCESS_SECRET=            # Required: min 32 chars — signing secret for access tokens
JWT_REFRESH_SECRET=           # Required: min 32 chars — signing secret for refresh tokens
JWT_ACCESS_EXPIRES_IN=15m     # Optional: access token TTL (default: 15m)
JWT_REFRESH_EXPIRES_IN=7d     # Optional: refresh token TTL (default: 7d)

CORS_ORIGINS=http://localhost:3000  # Optional: comma-separated allowed origins (default: http://localhost:3000)

RATE_LIMIT_WINDOW_MS=900000   # Optional: rate-limit window in ms (default: 15 min)
RATE_LIMIT_MAX=300            # Optional: max requests per window (default: 300)
```

### README Update

Add a small warning block in the "Variables de Entorno" or "Instalación" section:

> ⚠️ **Nunca commitees el archivo `.env`** — ya está incluido en `.gitignore`. Para generar los secrets de JWT puedes usar `openssl rand -base64 32`.

---

## 7. Capability 4: Testing Infrastructure Extension

### `openspec/config.yaml` Changes

Update the existing testing metadata block:

```yaml
testing:
  runner: bun
  test_command: bun test
  coverage_command: bun test --coverage
  projects:
    - path: .
      stack: "Bun + TypeScript + Express + Mongoose"
      test_command: bun test
      framework: bun:test
      test_layers:
        unit: true
        integration: true   # ← changed from false
        e2e: false
```

### Package Scripts

Optionally add to `package.json`:

```json
{
  "scripts": {
    "test:integration": "bun test src/tests/integration"
  }
}
```

This is a convenience for local development; CI continues to use `bun test`.

---

## 8. Dependency & Sequencing Notes

| Dependency | Direction | Note |
|------------|-----------|------|
| `backend-database-stability` | **Prerequisite** (soft) | This design assumes `dbReady` lazy-connect middleware has been removed. If `backend-database-stability` has not landed, integration tests must call `connectDatabase()` explicitly in `beforeAll` (the setup already does this). The design remains valid either way. |
| `integration-testing` → `testing-infrastructure` | Extends | Integration tests reuse the existing co-location convention (`*.test.ts` next to source) and the `bun:test` runner. |
| `ci-cd-pipeline` → `integration-testing` | Consumes | CI runs `bun test`, which discovers and executes the new integration tests. |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `mongodb-memory-server` binary download fails or is slow in CI | Medium | Medium | Pin package version; cache `~/.cache/mongodb-memory-server/` in GitHub Actions; set `MONGOMS_DOWNLOAD_TIMEOUT=120000`. |
| `env.ts` evaluates before `setup.ts` sets `process.env` | Low | High | Enforce static import of `setup.ts` as the **first** import in every integration test file. Document this as a project convention. Existing unit tests do not transitively import `env.ts`, so there is no race from that side. |
| `rateLimiter.test.ts` flakiness due to timing | Low | Low | Use a 1-second window and 2-request limit. Add a small `await new Promise(r => setTimeout(r, 1100))` before the blocked request if needed, or rely on supertest's sequential execution. |
| Integration tests increase `bun test` duration locally | Medium | Low | Integration tests are lightweight (~4 middleware + 1 E2E). On modern hardware the full suite (unit + integration) should complete in under 10 seconds. |
| `.env.example` drifts when new env vars are added | High | Low | Mitigation is manual review. Future enhancement: a CI lint step that compares `env.ts` schema keys against `.env.example` keys. |

---

## 10. Rollback Plan

1. Revert `package.json` to remove `mongodb-memory-server`, `supertest`, and any new scripts.
2. Delete `.github/workflows/ci.yml`.
3. Delete `.env.example`.
4. Delete `src/tests/integration/` directory and all co-located middleware `*.test.ts` files.
5. Revert `src/presentation/http/middlewares/rateLimiter.ts` to remove `createGeneralLimiter`.
6. Revert `openspec/config.yaml` to set `integration: false`.
7. Revert `README.md` to remove the `.env` warning / secret guidance.
8. Verify: `bun run build` passes and `bun test` runs only the 15 existing unit tests.

---

## 11. Verification Checklist

- [ ] `bun test` discovers and runs all 15 unit tests + 5 integration test files with exit code 0.
- [ ] `bun test` executes the E2E auth-lifecycle test against the in-memory database.
- [ ] Each middleware integration test exercises real HTTP requests through the Express app.
- [ ] `rateLimiter.test.ts` asserts `429` after exceeding the custom 2-request limit.
- [ ] GitHub Actions workflow runs on a PR and passes all four steps (typecheck → lint → test → build).
- [ ] Pushing directly to `main` triggers the workflow; pushing to a feature branch without a PR does **not**.
- [ ] `.env.example` contains every variable declared in `src/config/env.ts`.
- [ ] `README.md` warns against committing `.env` and explains how to generate JWT secrets.
- [ ] `openspec/config.yaml` reflects `integration: true`.
- [ ] `tsc --noEmit` (build step) reports zero errors.
- [ ] `biome check .` reports zero lint errors.
