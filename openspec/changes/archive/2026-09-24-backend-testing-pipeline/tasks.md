# Tasks: backend-testing-pipeline

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~270-400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Task Breakdown

- [x] 1. Add integration test dependencies and rate-limiter factory
  - Add `mongodb-memory-server`, `supertest`, and `@types/supertest` to `devDependencies` in `package.json`.
  - Export `createGeneralLimiter(windowMs, limit)` factory from `src/presentation/http/middlewares/rateLimiter.ts`; keep existing `generalLimiter` and `authLimiter` constants unchanged.
  - Run `bun install` and verify `bun run build` passes with zero TypeScript errors.

- [x] 2. Create shared integration test infrastructure
  - Create `src/tests/integration/setup.ts`:
    - Module-level `process.env` bootstrap (`NODE_ENV=test`, JWT secrets with ≥32 chars, `CORS_ORIGINS`, rate-limit defaults) so `src/config/env.js` sees test-safe values on first evaluation.
    - `startTestDatabase()` — `MongoMemoryServer` singleton, sets `process.env.MONGO_URI`, then dynamically imports `src/infrastructure/database/mongoose.js` and calls `connectDatabase()`.
    - `stopTestDatabase()` — disconnect Mongoose and stop the memory server.
    - `cleanDatabase()` — iterate `mongoose.models` and call `deleteMany({})` on each so every test starts with an empty database.
  - Create `src/tests/integration/helpers/auth.ts` with `generateAccessToken(userId, role)` and `generateAuthHeader(userId, role)` using `JwtService`; use relative imports with `.js` extension.
  - Verify both files compile: `bun run build`.

- [x] 3. Implement authenticate middleware integration tests
  - Create `src/presentation/http/middlewares/authenticate.test.ts`.
  - Import `src/tests/integration/setup.js` as the **first** static import.
  - In `beforeAll`: call `startTestDatabase()`, then dynamically import `createServer()` from `../../server.js`.
  - In `beforeEach`: call `cleanDatabase()`.
  - In `afterAll`: call `stopTestDatabase()`.
  - Scenarios:
    1. Missing `Authorization` header on `GET /api/users/me` → `401`, `success: false`, auth failure message.
    2. Invalid or expired token on `GET /api/users/me` → `401`, `success: false`, invalid/expired message.
    3. Valid token for an existing user on `GET /api/users/me` → `200`.
  - Run `bun test src/presentation/http/middlewares/authenticate.test.ts` and verify all assertions pass.

- [x] 4. Implement authorize middleware integration tests
  - Create `src/presentation/http/middlewares/authorize.test.ts`.
  - Import `src/tests/integration/setup.js` as the **first** static import; use the same lifecycle hooks as task 3.
  - Scenarios:
    1. User-role token accessing admin-only `GET /api/users/` → `403`, `success: false`, authorization failure message.
    2. Admin-role token accessing `GET /api/users/` → `200`.
  - Run `bun test src/presentation/http/middlewares/authorize.test.ts` and verify all assertions pass.

- [x] 5. Implement errorHandler and rateLimiter middleware integration tests
  - Create `src/presentation/http/middlewares/errorHandler.test.ts`:
    - Import `setup.js` first; use the same lifecycle hooks.
    - After `createServer()` returns, dynamically attach `/test/app-error` (throws `NotFoundError`) and `/test/native-error` (throws native `Error`) to the returned app.
    - Assert `GET /test/app-error` → `404`, `success: false`, error message.
    - Assert `GET /test/native-error` → `500`, `success: false`, generic server message.
  - Create `src/presentation/http/middlewares/rateLimiter.test.ts`:
    - Use a standalone Express app (not the full server) with `createGeneralLimiter(1000, 2)`.
    - Assert first 2 requests to `GET /test` → `200`.
    - Assert 3rd request → `429`, `success: false`, rate-limit message.
  - Run both test files and verify they pass.

- [x] 6. Implement E2E auth lifecycle integration test
  - Create `src/tests/integration/e2e/auth-lifecycle.test.ts`.
  - Import `src/tests/integration/setup.js` as the **first** static import.
  - In `beforeAll`: call `startTestDatabase()`, then dynamically import `createServer()`.
  - In `beforeEach`: call `cleanDatabase()`.
  - In `afterAll`: call `stopTestDatabase()`.
  - Scenario A — Happy path:
    1. `POST /api/auth/register` with valid payload → `201`.
    2. `POST /api/auth/login` with same credentials → `200`, extract `accessToken`.
    3. `GET /api/users/me` with `Authorization: Bearer <accessToken>` → `200`, response body contains registered user's `email`.
  - Scenario B — Missing token after login:
    1. Register and login as in Scenario A.
    2. `GET /api/users/me` without `Authorization` → `401`.
  - Run `bun test src/tests/integration/e2e/auth-lifecycle.test.ts` and verify all assertions pass.

- [x] 7. Create environment documentation
  - Create `.env.example` at project root listing every variable declared in `src/config/env.ts`.
  - Each entry must appear on its own line with an inline comment describing purpose, expected format, and whether it is required or optional.
  - Update `README.md`:
    - In the "Variables de Entorno" or "Instalación" section, add a warning block instructing not to commit `.env` (it is already in `.gitignore`).
    - Add guidance on generating JWT secrets using `openssl rand -base64 32`.
  - Verify completeness by comparing all `envSchema` keys against `.env.example`.

- [x] 8. Create CI workflow and update OpenSpec metadata
  - Create `.github/workflows/ci.yml`:
    - Triggers: `pull_request` (all target branches) and `push` to `main` only.
    - Job runs on `ubuntu-latest` with `oven-sh/setup-bun@v2`.
    - Steps execute sequentially with fail-fast behavior: `bun run typecheck` → `bun run lint` → `bun test` → `bun run build`.
    - Cache `~/.bun/install/cache` and `~/.cache/mongodb-memory-server/`.
    - Set workflow env var `MONGOMS_DOWNLOAD_TIMEOUT: 120000`.
  - Update `openspec/config.yaml`: set `testing.projects[0].test_layers.integration: true`.
  - Optionally add `"test:integration": "bun test src/tests/integration"` to `package.json` scripts.
  - Run `bun run build`, `bun run lint`, and `bun test` to confirm all existing unit tests plus all new integration tests pass with zero regressions.
