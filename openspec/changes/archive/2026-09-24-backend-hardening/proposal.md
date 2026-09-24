# Proposal: Backend Hardening Initiative

## Intent

A code review identified 10 technical gaps across testing, infrastructure, security, and observability. This proposal evaluates total scope, selects a grouping strategy, and defines the capabilities required to close all gaps without exceeding the 400-line review budget or creating unreviewable mega-PRs.

## Scope Evaluation

### Total Raw Scope

| # | Improvement | Priority | Est. Lines | Blast Radius |
|---|-------------|----------|-----------|--------------|
| 1 | Integration/E2E tests (mongodb-memory-server, supertest, middleware coverage) | 🔴 High | ~220–300 | New files only; touches no runtime paths |
| 2 | CI/CD GitHub Actions (typecheck + lint + test + build) | 🔴 High | ~50–70 | `.github/workflows/` only |
| 3 | `.env.example` with documented variables | 🔴 High | ~20–30 | New file only |
| 4 | DB connection lazy race condition (`dbReady` flag) | 🟡 Med | ~15–25 | `server.ts`, `index.ts` |
| 5 | Consecutive race condition (`getNextConsecutive` non-atomic) | 🟡 Med | ~20–40 | `RemisionRepository.ts` |
| 6 | Structured logging (pino/winston, JSON, request ID, user ID) | 🟡 Med | ~80–120 | Cross-cutting: middleware, controllers, error handler |
| 7 | Real health check (MongoDB readyState, 503 on failure) | 🟡 Med | ~15–25 | `server.ts` |
| 8 | Graceful shutdown (SIGTERM/SIGINT handlers) | 🟡 Med | ~30–50 | `index.ts`, `server.ts` |
| 9 | Document refresh-token single-device limitation | ⚪ Low | ~5–10 | `README.md` |
| 10 | Explicit CORS preflight (`app.options('*', cors())`) | ⚪ Low | ~5–10 | `server.ts` |
|   | **Total** | | **~460–680** | |

A single PR would exceed the 400-line review threshold, mix unrelated concerns (tests + DB fixes + logging), and be hard to roll back surgically.

### Grouping Options

#### Option A — Single Large Change (`backend-hardening`)
- **Size**: 460–680 changed lines — exceeds review budget.
- **Risk**: High blast radius; a regression in logging or DB connection could block the entire initiative.
- **Verdict**: **Rejected.** Violates the 400-line canonical threshold and couples unrelated domains.

#### Option B — High-Priority Only (items 1–3)
- **Size**: ~290–400 lines — at the budget ceiling.
- **Risk**: Tests + CI + `.env.example` are cohesive, but item 1 alone could push near 300 lines; little room for CI review feedback.
- **Verdict**: **Partially viable** as the first slice, but leaves 7 medium/low items unaddressed.

#### Option C — 3 Focused Changes (Recommended)
Split by cohesion and risk domain:

1. **`backend-testing-pipeline`** — items 1, 2, 3 (tests, CI, env docs)
2. **`backend-database-stability`** — items 4, 5, 7, 8 (connection, concurrency, health, shutdown)
3. **`backend-observability`** — items 6, 9, 10 (logging, docs, CORS preflight)

- **Size per change**: ~270–400 / ~80–140 / ~90–140 lines.
- **Risk**: Each change is reviewable, rollback is surgical, and sequencing can respect operational urgency.
- **Verdict**: **Recommended.**

### Recommended Sequence

1. **`backend-database-stability`** first — fixes production race conditions and adds health/shutdown reliability.
2. **`backend-testing-pipeline`** second — establishes integration/E2E coverage and CI gating; can validate the DB fixes.
3. **`backend-observability`** third — cross-cutting logging improvement, safest to land after tests exist.

Changes 2 and 3 can be developed in parallel if bandwidth allows; change 1 should land first because it fixes active bugs.

---

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### Existing Specs (context only)
- `testing-infrastructure` — unit test conventions, Bun runner, co-located `*.test.ts` (already implemented).
- `api-pagination` — pagination query schema and response shape (already implemented).
- `remision-search` — search/filter requirements (already implemented).

### New Capabilities

| Capability | Belongs to Change | Description |
|-----------|-------------------|-------------|
| `integration-testing` | `backend-testing-pipeline` | MongoDB in-memory test database (`mongodb-memory-server`), HTTP-level test harness (supertest or `Request` from `bun:test`), test helpers for auth headers and DB cleanup, middleware integration tests (`authenticate`, `authorize`, `errorHandler`, `rateLimiter`). |
| `ci-cd-pipeline` | `backend-testing-pipeline` | GitHub Actions workflow running typecheck → lint → test → build on every PR and push to `main`; fails fast on first step failure. |
| `environment-documentation` | `backend-testing-pipeline` | `.env.example` file listing every required and optional environment variable with inline comments; referenced from README setup instructions. |
| `database-connection-reliability` | `backend-database-stability` | Eager database connection before HTTP listener starts, removal of `dbReady` lazy-connect flag, graceful shutdown handlers for `SIGTERM`/`SIGINT` that close the server and MongoDB connection. |
| `remision-concurrency-safety` | `backend-database-stability` | Atomic consecutive number generation via `findOneAndUpdate` with `$inc` or unique compound index with retry loop; eliminates race condition in `RemisionRepository.getNextConsecutive()`. |
| `health-monitoring` | `backend-database-stability` | `/health` endpoint inspects `mongoose.connection.readyState`; returns 200 with `{ status: "ok", db: "connected" }` when ready, 503 with `{ status: "degraded", db: "disconnected" }` otherwise. |
| `structured-logging` | `backend-observability` | Replace `console.error` and `morgan` with a structured logger (pino or winston) outputting JSON; attach request ID (via `X-Request-Id` or `crypto.randomUUID`) and authenticated user ID to every log line; configurable log level via `LOG_LEVEL` env var; suppress HTTP logs in test environment. |
| `api-cors-preflight` | `backend-observability` | Explicit `app.options("*", cors())` handler so preflight behavior is deterministic and documented; no functional change to existing CORS policy. |
| `refresh-token-limitation-docs` | `backend-observability` | README section documenting that refresh-token rotation stores a single hash per user, so logging in on a second device invalidates the first session; labeled as known limitation with workaround guidance. |

### Modified Capabilities
- `testing-infrastructure` — extended to include integration layer conventions (test DB lifecycle, HTTP request helpers) in addition to existing unit conventions.

---

## Affected Areas

### Change 1: `backend-testing-pipeline`

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `mongodb-memory-server`, `supertest` (or `@types/supertest` if needed) to devDependencies; possibly add `test:integration` script. |
| `.github/workflows/ci.yml` | New | GitHub Actions workflow with Bun setup, typecheck, lint, test, build jobs. |
| `.env.example` | New | Complete environment variable template with comments. |
| `README.md` | Modified | Update setup instructions to reference `.env.example` instead of manual env listing. |
| `src/presentation/http/middlewares/authenticate.ts` | Modified | Add `authenticate.test.ts` co-located (integration tests with real JWT verify path). |
| `src/presentation/http/middlewares/authorize.ts` | Modified | Add `authorize.test.ts` co-located. |
| `src/presentation/http/middlewares/errorHandler.ts` | Modified | Add `errorHandler.test.ts` co-located. |
| `src/presentation/http/middlewares/rateLimiter.ts` | Modified | Add `rateLimiter.test.ts` co-located. |
| `src/infrastructure/database/mongoose.ts` | Modified | Add `mongoose.test.ts` or test helper for in-memory DB lifecycle. |
| `openspec/changes/backend-testing-pipeline/specs/` | New | Capability specs for integration-testing, ci-cd-pipeline, environment-documentation. |

### Change 2: `backend-database-stability`

| Area | Impact | Description |
|------|--------|-------------|
| `src/presentation/http/server.ts` | Modified | Remove lazy `dbReady` connect middleware; move `connectDatabase()` to boot sequence; update `/health` to check `mongoose.connection.readyState`; add explicit `app.options("*", cors())` (moved here if preferred, or keep in change 3). |
| `src/index.ts` | Modified | Await `connectDatabase()` before `app.listen()`; register `SIGTERM`/`SIGINT` handlers calling `server.close()` and `disconnectDatabase()`. |
| `src/infrastructure/repositories/RemisionRepository.ts` | Modified | Replace non-atomic `findOne + 1` with atomic `findOneAndUpdate` on a counter document or `$inc`-based strategy; add compound unique index on `(companyId, consecutive)` as safety net. |
| `src/infrastructure/repositories/RemisionRepository.ts` | Modified | Add repository-level test for concurrent consecutive generation. |
| `openspec/changes/backend-database-stability/specs/` | New | Capability specs for database-connection-reliability, remision-concurrency-safety, health-monitoring. |

### Change 3: `backend-observability`

| Area | Impact | Description |
|------|--------|-------------|
| `src/shared/logger.ts` | New | Logger factory/module wrapping pino or winston with JSON output, log level from env, and child logger support for request context. |
| `src/presentation/http/server.ts` | Modified | Replace `morgan` and `console.error` usage with structured logger; add request-ID middleware. |
| `src/presentation/http/middlewares/errorHandler.ts` | Modified | Log errors via structured logger instead of `console.error`. |
| `src/presentation/http/middlewares/authenticate.ts` | Modified | Attach `userId` to logger context or `res.locals` for downstream correlation. |
| `src/config/env.ts` | Modified | Add `LOG_LEVEL` optional env var with default. |
| `README.md` | Modified | Add refresh-token limitation section. |
| `openspec/changes/backend-observability/specs/` | New | Capability specs for structured-logging, api-cors-preflight, refresh-token-limitation-docs. |

---

## Dependencies

| Dependency | From | To | Reason |
|-----------|------|-----|--------|
| `ci-cd-pipeline` | `backend-testing-pipeline` | `integration-testing` | CI workflow runs `bun test`, which must include integration tests. |
| `integration-testing` | `backend-testing-pipeline` | `testing-infrastructure` | Integration tests extend existing unit conventions (file naming, co-location). |
| `health-monitoring` | `backend-database-stability` | `database-connection-reliability` | Health check validates the same connection managed by the reliability fix. |
| `structured-logging` | `backend-observability` | `database-connection-reliability` (soft) | Logger should ideally log shutdown events; can be wired after. |

No circular dependencies. Changes 2 and 3 can be developed in parallel once change 1 is specced.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Integration tests flake due to `mongodb-memory-server` download or port conflicts in CI. | Med | Med | Pin `mongodb-memory-server` version; use `MONGOMS_DOWNLOAD_TIMEOUT`; run tests serially if needed. |
| Atomic consecutive fix changes the Remision creation contract if unique index violations surface. | Low | High | Add unique compound index as safety net, but implement atomic increment so collisions are theoretically impossible; test with concurrent `Promise.all` insertions. |
| Structured logger JSON output breaks local developer experience (harder to read). | Med | Low | Configure pino pretty-print in development via `LOG_LEVEL=debug` and `NODE_ENV=development`; production stays JSON. |
| Graceful shutdown on Vercel serverless may never fire (serverless functions are ephemeral). | Med | Low | Implement handlers anyway for local/docker runs; on Vercel the MongoDB connection pool reaps itself; document this behavior. |
| `.env.example` drifts out of date as new env vars are added. | High | Low | Add CI step that fails if `env.ts` references a variable missing from `.env.example` (future enhancement). |
| E2E middleware tests for `rateLimiter` are slow or flaky in CI. | Low | Med | Use a separate test-specific rate limiter instance with very short windows, or mock the store in unit tests and only integration-test the middleware wiring. |

---

## Rollback Plan

### Per-Change Rollback

**`backend-testing-pipeline`**
1. Revert `package.json` to remove test dependencies and scripts.
2. Delete `.github/workflows/ci.yml`.
3. Delete `.env.example`.
4. Delete all `*.test.ts` files added for middleware/integration.
5. Revert README setup instructions.
6. Verify with `bun run build` and `bun test` (unit tests only must still pass).

**`backend-database-stability`**
1. Revert `server.ts` to restore lazy `dbReady` connect and stub `/health`.
2. Revert `index.ts` to remove `connectDatabase()` await and shutdown handlers.
3. Revert `RemisionRepository.ts` to restore non-atomic `getNextConsecutive`.
4. Remove unique compound index on `(companyId, consecutive)` if added.
5. Verify with `bun run build` and existing unit tests.

**`backend-observability`**
1. Delete `src/shared/logger.ts`.
2. Revert `server.ts` to restore `morgan` and `console.error`.
3. Revert `errorHandler.ts` to restore `console.error` usage.
4. Revert `env.ts` to remove `LOG_LEVEL`.
5. Revert README to remove refresh-token limitation section.
6. Verify with `bun run build` and existing tests.

### Full Initiative Rollback
Execute the three per-change rollbacks in reverse order (observability → database-stability → testing-pipeline) to avoid intermediate broken states.

---

## Success Criteria

### `backend-testing-pipeline`
- [ ] `bun test` executes integration tests using `mongodb-memory-server` with zero exit code.
- [ ] At least one integration test exercises each middleware (`authenticate`, `authorize`, `errorHandler`, `rateLimiter`) through real HTTP requests.
- [ ] At least one E2E-style test executes a full request lifecycle (e.g., `POST /api/auth/register` → `POST /api/auth/login` → authenticated `GET /api/remisiones`).
- [ ] GitHub Actions workflow runs typecheck, lint, test, and build on every PR.
- [ ] CI fails when a test fails or when `bun run build` emits TypeScript errors.
- [ ] `.env.example` exists and contains every variable referenced in `src/config/env.ts`.

### `backend-database-stability`
- [ ] `server.ts` no longer contains `dbReady`; database connects eagerly before HTTP listener starts.
- [ ] Concurrent creation of remisiones for the same company never produces duplicate `consecutive` values (verified by concurrent test).
- [ ] `/health` returns HTTP 200 when MongoDB is connected and HTTP 503 when disconnected.
- [ ] `SIGTERM` and `SIGINT` close the HTTP server and MongoDB connection before process exit.
- [ ] All existing unit tests continue to pass.

### `backend-observability`
- [ ] No `console.error` or `morgan` usage remains in production paths; all logging goes through structured logger.
- [ ] Every HTTP request log includes a `requestId` field.
- [ ] Authenticated request logs include a `userId` field.
- [ ] Log output is JSON in production and human-readable in development.
- [ ] `README.md` contains a section explaining the single-device refresh-token limitation.
- [ ] Explicit `app.options("*", cors())` handler exists in `server.ts`.

---

## Proposal Question Round

Before finalizing the spec phase, the following assumptions should be confirmed or corrected:

1. **Integration test runner**: Should E2E tests use `supertest` (new dependency) or Bun's native `Request`/`Response` objects to avoid extra deps? Supertest is familiar but adds a dependency; native Bun testing is lighter but less ergonomic for Express.
2. **Logger choice**: Is `pino` preferred over `winston`? Pino is faster and Bun-friendly; winston has more transports. The default assumption is `pino` with `pino-pretty` for dev.
3. **Atomic consecutive strategy**: Should the fix use a dedicated counter collection (`findOneAndUpdate` with `$inc`) or a compound unique index with retry on the existing `Remision` collection? A counter collection is cleaner but adds a new MongoDB collection; unique index with retry is simpler but slightly more complex error handling.
4. **CI trigger branches**: Should the GitHub Actions workflow run on PRs to `main` only, or on all branches? Assumption: all PRs + pushes to `main`.
5. **Vercel-specific graceful shutdown**: Given Vercel serverless functions may not receive SIGTERM, should graceful shutdown be implemented with a short timeout (e.g., 5s) to match Vercel's function lifecycle, or optimized for long-running container/local environments?
