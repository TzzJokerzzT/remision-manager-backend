# Design: Backend Observability

## Overview

This change introduces three independent capabilities to the remision-manager-backend:

1. **structured-logging** — Replace ad-hoc `console.log/error` and `morgan` with JSON-structured logs via `pino`, carrying `requestId` and `userId` context, configurable `LOG_LEVEL`, dev pretty-printing, and suppression of HTTP logs in tests.
2. **api-cors-preflight** — Register an explicit `OPTIONS *` handler so CORS preflight behavior is deterministic and documented.
3. **refresh-token-limitation-docs** — Document the single-device refresh-token limitation in `README.md`.

**Estimated scope:** ~90–140 changed lines across 10 files.

**Assumptions from prior changes:**
- `backend-database-stability` has landed and removed the `dbReady` middleware from `server.ts`.
- `backend-testing-pipeline` has landed and expects `pino` to be available for integration tests.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Logger library | `pino` + `pino-http` + `pino-pretty` | Fast, JSON-first, ESM-compatible, minimal overhead. `pino-http` is the idiomatic Express companion and automatically handles `X-Request-Id` header ingestion / generation and response attachment. |
| Logger module location | `src/shared/logger.ts` | The project already places cross-cutting utilities in `src/shared/`. Logging is consumed by `config/env.ts`, `infrastructure/database/mongoose.ts`, `index.ts`, and `presentation/http/*`. Keeping it in `shared` avoids circular imports (`config` → `shared` is safe) and matches existing convention. |
| Pretty-print transport | `pino-pretty` as **devDependency**, enabled only when `NODE_ENV === "development"` | Structured guarantee is preserved: output is still valid JSON after stripping ANSI codes. In production and test the transport is `undefined`, so `pino-pretty` is never required at runtime. |
| HTTP log suppression in test | Skip `pino-http` middleware registration entirely when `NODE_ENV === "test"` | Simplest and most reliable way to guarantee zero HTTP request/response log output in tests, regardless of `LOG_LEVEL`. |
| Request ID propagation | `pino-http` `genReqId` reads `X-Request-Id` header or falls back to `crypto.randomUUID()`; header is echoed on the response automatically | Meets the spec without custom middleware. `crypto.randomUUID()` is native in Bun/Node 14.17+. |
| User ID propagation | `pino-http` `customProps` reads `req.user?.id` and injects `userId` into every automatic request log | Non-invasive; does not require mutating `req.log`. Controllers that manually log during a request should use `req.log` (which already carries `requestId`). If they need `userId` in manual logs, they can call `req.log.child({ userId })`. |
| `console.error` in `env.ts` | **Keep as-is** | `env.ts` validates environment at module-load time. Importing the logger would create a circular dependency (`logger` reads `env`, `env` cannot read `logger`). Bootstrap-time failures should remain on `stderr` via `console.error`. |
| Explicit OPTIONS handler | `app.options("*", cors(corsOptions))` using the **same** options object as the existing `app.use(cors(...))` | Guarantees identical policy. Placed before route registration so preflight never reaches a route handler. |
| Graceful shutdown timeout | Already handled by `backend-database-stability` (5 s) | No change required in this design. |

---

## Data Flow

### Request Lifecycle with Structured Logging

```
Client ──► [X-Request-Id: abc] ──► Express
                                      │
                              ┌───────▼────────┐
                              │ pino-http      │ ──► generates/reads requestId
                              │ (skipped test) │ ──► attaches req.log (child of root logger)
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │ authenticate() │ ──► on success, customProps sees req.user.id
                              └───────┬────────┘      and injects userId into request log
                                      │
                              ┌───────▼────────┐
                              │ Route handler  │ ──► can use req.log.info(...) etc.
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │ errorHandler   │ ──► logs via req.log.error({ err }, ...)
                              └───────┬────────┘      or falls back to root logger
                                      │
                              ┌───────▼────────┐
                              │ pino-http      │ ──► emits structured access log with
                              │ auto-logging   │     requestId + userId + response status
                              └────────────────┘
```

### Logger Hierarchy

```
root logger (src/shared/logger.ts)
    │ level = env.LOG_LEVEL
    │ transport = pino-pretty (dev only)
    │
    ├──► boot logs (src/index.ts, src/infrastructure/database/mongoose.ts)
    │
    └──► pino-http middleware
            │
            ├──► req.log  (child with requestId)
            │       │
            │       └──► manual logs from controllers / errorHandler
            │
            └──► auto-logged request/response line
                    (enriched via customProps with userId when authenticated)
```

---

## File Changes

### New Files

#### `src/shared/logger.ts`
- Exports a single `pino` instance configured with:
  - `level`: `env.LOG_LEVEL`
  - `transport`: `pino-pretty` (dev only)
- This is the root logger imported by bootstrap code, `pino-http`, and the fallback in `errorHandler`.

#### `src/shared/types/express.d.ts`
- Augments `express-serve-static-core.Request` to add:
  - `requestId?: string`
  - `log?: import('pino').Logger`
- Ensures TypeScript knows about `req.log` across the codebase without casting.

### Modified Files

#### `package.json`
- **Remove:** `morgan`, `@types/morgan`
- **Add dependencies:** `pino`, `pino-http`
- **Add devDependencies:** `pino-pretty`
- Rationale: `morgan` is replaced by `pino-http`. `pino-pretty` is dev-only.

#### `src/config/env.ts`
- Add `LOG_LEVEL` to the Zod schema:
  ```ts
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info")
  ```
- Expose it in the exported `env` object.
- Keep `console.error` for schema-validation failure (bootstrap-time circular-dependency guard).

#### `src/presentation/http/server.ts`
- Remove `morgan` import and `morgan(...)` middleware.
- Extract existing `cors(...)` options into a `const corsOptions`.
- Add explicit preflight handler **before** routes:
  ```ts
  app.options("*", cors(corsOptions));
  ```
- Import `pinoHttp` and `logger`.
- Register `pinoHttp` middleware **conditionally**:
  ```ts
  if (env.NODE_ENV !== "test") {
    app.use(pinoHttp({
      logger,
      genReqId: (req) =>
        (req.headers["x-request-id"] as string) || crypto.randomUUID(),
      customProps: (req) => {
        const user = (req as AuthenticatedRequest).user;
        return { userId: user?.id ?? null };
      },
    }));
  }
  ```
- Remove the `dbReady` inline middleware (assumed already removed by `backend-database-stability`).

#### `src/presentation/http/middlewares/errorHandler.ts`
- Replace `console.error("💥 Error no controlado:", err)` with:
  ```ts
  const log = (req as Request).log ?? logger;
  log.error({ err }, "Unhandled error");
  ```
- Import the root `logger` from `../../../shared/logger.js` for the fallback.
- Rename parameter `_req` → `req` to access `req.log`.

#### `src/presentation/http/middlewares/authenticate.ts`
- No structural changes required.
- `req.user` is already populated here; `pino-http` `customProps` reads it downstream.
- If future controllers want manual logs with `userId`, they can call `req.log.child({ userId: req.user.id })`.

#### `src/infrastructure/database/mongoose.ts`
- Replace `console.log("✅ MongoDB conectado")` with `logger.info("MongoDB connected")`.
- Replace `console.error("❌ Error conectando a MongoDB:", error)` with `logger.error({ err: error }, "MongoDB connection failed")`.
- Import `logger` from `../../shared/logger.js`.

#### `src/index.ts`
- Replace `console.log("🚀 Servidor en http://localhost:...")` with `logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Server started")`.
- Import `logger` from `./shared/logger.js`.

#### `README.md`
- **Dependencies table:** replace `morgan` with `pino`, `pino-http`, `pino-pretty`.
- **Environment variables section:** add `LOG_LEVEL=info`.
- **New section:** "Known Limitations → Refresh Token Rotation" placed after the existing "Seguridad Implementada" section (or as a sub-section within it). The section must:
  - State that only one refresh-token hash is stored per user.
  - Explain that a new login overwrites the stored hash, invalidating previous refresh tokens.
  - Frame this as an intentional simplicity trade-off, not a bug.
  - Provide client-side workaround guidance (e.g., share the refresh token across browser tabs via the same storage mechanism, or plan for re-authentication when switching devices).
  - Avoid implying multi-device concurrent sessions are supported.

---

## Contracts

### Logger Interface (provided by `pino`)

All code should treat the logger as the standard `pino.Logger` interface:

```typescript
logger.info({ key: "value" }, "message");
logger.error({ err: error }, "something failed");
```

Inside request handlers, prefer `req.log` (guaranteed to carry `requestId`):

```typescript
req.log.info({ userId: req.user?.id }, "Action performed");
```

### Express Request Augmentation

```typescript
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      log?: import("pino").Logger;
    }
  }
}
```

### pino-http Configuration Contract

| Option | Value | Why |
|---|---|---|
| `logger` | root `pino` instance | Shared level and transport config. |
| `genReqId` | header or `crypto.randomUUID()` | Spec requirement for inbound request ID reuse. |
| `customProps` | `{ userId: req.user?.id \|\| null }` | Adds user context to every request log line. |
| `wrapSerializers` | default (`true`) | Ensures standard serializers for `err` and `req`/`res`. |

---

## Testing Approach

| Test Type | What to Verify |
|---|---|
| **Unit** | `src/shared/logger.ts` exports a valid pino instance; `LOG_LEVEL` filters correctly. |
| **Integration** | An HTTP request produces a single JSON log line containing `requestId`. An authenticated request’s log line contains `userId`. `X-Request-Id` header is echoed. `OPTIONS /api/remisiones` returns `204` with CORS headers. No HTTP log is emitted when `NODE_ENV=test`. |
| **Manual / E2E** | Start in development: logs are pretty-printed. Start in production: logs are raw JSON. |

**Test environment note:** Because `pino-http` middleware is skipped in `test`, integration tests that inspect stdout/stderr will not see HTTP access-log noise. Application-level logs (e.g., DB connection) may still appear during integration test boot if the logger is imported by `index.ts` or `mongoose.ts`; this is acceptable because the spec only mandates suppression of *HTTP* request/response logs.

---

## Rollout

1. Install new dependencies (`bun add pino pino-http`; `bun add -d pino-pretty`).
2. Uninstall `morgan` and `@types/morgan`.
3. Add `LOG_LEVEL` to `.env.example`.
4. Implement files in this order:
   - `src/shared/logger.ts`
   - `src/shared/types/express.d.ts`
   - `src/config/env.ts`
   - `src/presentation/http/server.ts`
   - `src/presentation/http/middlewares/errorHandler.ts`
   - `src/infrastructure/database/mongoose.ts`
   - `src/index.ts`
   - `README.md`
5. Run `bun run build` to verify types.
6. Run `bun test` to confirm zero HTTP log output in test.
7. Run `bun run dev` and send a request with/without `X-Request-Id` to verify `requestId` and `userId` propagation.
8. Verify `OPTIONS /health` returns CORS headers.

---

## Threat Matrix

| Concern | Assessment |
|---|---|
| Routing | N/A — no new routes; only an explicit `OPTIONS` wildcard handler. |
| Shell / subprocess | N/A — no shell execution. `pino-pretty` is loaded via pino’s worker thread transport only in development. |
| Injection | N/A — log messages are user-controlled strings only in existing error paths; pino’s standard serializers safely handle objects. |
| Information disclosure | Error stack traces are already gated behind `NODE_ENV === "development"` in `errorHandler.ts`; this design preserves that gate. `requestId` exposure in headers is intentional for client-side correlation. |

---

## Key Learnings

1. Bootstrap-time code such as `env.ts` cannot import a logger that itself depends on `env.ts` without creating a circular dependency, so validation failures should remain on raw `stderr`.
2. Skipping the `pino-http` middleware registration entirely in test mode is more reliable than configuring a silent log level because it eliminates all request/response log side effects regardless of `LOG_LEVEL`.
3. Reusing the exact same `cors(options)` object for both `app.use()` and `app.options("*")` guarantees that the explicit preflight handler does not accidentally diverge from the existing CORS policy.
4. The `pino-http` `customProps` hook is the least invasive way to inject `userId` into every automatic request log without mutating `req.log` inside authentication middleware.
