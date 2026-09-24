# Tasks: backend-observability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~90–140 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Task Breakdown

- [x] 1. Add dependencies and `LOG_LEVEL` environment variable
  - In `package.json`:
    - **Add** `pino` and `pino-http` to `dependencies`.
    - **Add** `pino-pretty` to `devDependencies`.
    - **Remove** `morgan` and `@types/morgan`.
  - In `src/config/env.ts`:
    - Add `LOG_LEVEL` to the Zod schema:
      ```ts
      LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info")
      ```
    - Expose it in the exported `env` object.
    - Keep `console.error` for schema-validation failures (bootstrap circular-dependency guard).
  - If `.env.example` exists, add `LOG_LEVEL=info` to it.
  - Run `bun install` and verify `bun run build` passes with zero TypeScript errors.

- [x] 2. Write failing unit test for the shared logger module (RED)
  - Create `src/shared/logger.test.ts`.
  - Test cases:
    - `logger` exports a valid `pino` instance.
    - When `LOG_LEVEL=warn`, a `debug` log is not emitted.
    - When `LOG_LEVEL=warn`, an `error` log is emitted.
    - Default log level is `info` when `LOG_LEVEL` is unset.
  - Run `bun test src/shared/logger.test.ts`; expect failures because `src/shared/logger.ts` does not exist yet.

- [x] 3. Implement shared logger module and Express type augmentation (GREEN)
  - Create `src/shared/logger.ts`:
    - Import `pino` and `env`.
    - Export a single root `pino` instance with:
      - `level: env.LOG_LEVEL`
      - `transport: { target: "pino-pretty", options: { colorize: true } }` only when `env.NODE_ENV === "development"`; otherwise `undefined`.
  - Create `src/shared/types/express.d.ts`:
    - Augment `Express.Request` to add `requestId?: string` and `log?: import("pino").Logger`.
    - Ensure the file is included in TypeScript compilation (reference it or place it under `src/` so `tsc` discovers it).
  - Run `bun test src/shared/logger.test.ts` and verify all assertions pass.
  - Run `bun run build` to confirm zero type errors.

- [x] 4. Write failing integration tests for structured logging and CORS preflight (RED)
  - Create `src/tests/integration/observability.test.ts` (or equivalent path following the project's integration test convention).
  - Import the integration test setup (`src/tests/integration/setup.js`) as the **first** static import.
  - Use the standard lifecycle hooks (`beforeAll` → `startTestDatabase()` + dynamic `createServer()` import; `beforeEach` → `cleanDatabase()`; `afterAll` → `stopTestDatabase()`).
  - Test scenarios:
    - `GET /health` emits a structured JSON log line containing `requestId`.
    - `GET /health` with header `X-Request-Id: abc-123` echoes `X-Request-Id: abc-123` in the response.
    - An authenticated `GET /api/users/me` emits a log line containing `userId`.
    - `OPTIONS /api/remisiones` returns `204` (or `200`) with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`.
    - When `NODE_ENV=test`, no HTTP access log line is written.
  - Run the test file; expect failures because `pino-http` and the explicit `OPTIONS` handler are not wired yet.

- [x] 5. Wire structured logging and explicit CORS preflight into the HTTP stack (GREEN)
  - In `src/presentation/http/server.ts`:
    - Remove `morgan` import and the `morgan(...)` middleware block.
    - Extract the existing `cors({ ... })` options object into a `const corsOptions`.
    - Add explicit preflight handler **before** route registration:
      ```ts
      app.options("*", cors(corsOptions));
      ```
    - Import `pinoHttp` from `pino-http` and the root `logger` from `../../shared/logger.js`.
    - Register `pinoHttp` middleware conditionally:
      ```ts
      if (env.NODE_ENV !== "test") {
        app.use(pinoHttp({
          logger,
          genReqId: (req) => (req.headers["x-request-id"] as string) || crypto.randomUUID(),
          customProps: (req) => {
            const user = (req as AuthenticatedRequest).user;
            return { userId: user?.id ?? null };
          },
        }));
      }
      ```
    - Remove the `dbReady` inline middleware and its `connectDatabase` import if still present (should already be removed by `backend-database-stability`).
  - In `src/presentation/http/middlewares/errorHandler.ts`:
    - Import the root `logger` from `../../../shared/logger.js`.
    - Rename parameter `_req` → `req`.
    - Replace `console.error("💥 Error no controlado:", err)` with:
      ```ts
      const log = (req as Request).log ?? logger;
      log.error({ err }, "Unhandled error");
      ```
  - Run the integration tests from task 4 and verify they pass.
  - Run `bun run build` and `bun test` to confirm zero regressions in existing tests.

- [x] 6. Wire structured logger into bootstrap and database code (GREEN)
  - In `src/infrastructure/database/mongoose.ts`:
    - Import `logger` from `../../shared/logger.js`.
    - Replace `console.log("✅ MongoDB conectado")` with `logger.info("MongoDB connected")`.
    - Replace `console.error("❌ Error conectando a MongoDB:", error)` with `logger.error({ err: error }, "MongoDB connection failed")`.
  - In `src/index.ts`:
    - Import `logger` from `./shared/logger.js`.
    - Replace the `console.log` in `app.listen` with:
      ```ts
      logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Server started");
      ```
  - Run `bun run build` and `bun test` to confirm zero regressions.

- [x] 7. Document refresh-token limitation and update README (REFACTOR / docs)
  - In `README.md`:
    - Update the **Stack Tecnológico** dependencies table: replace `morgan` with `pino`, `pino-http`, `pino-pretty`.
    - In the **Variables de Entorno** section, add `LOG_LEVEL=info` with a brief description.
    - Add a new **Known Limitations → Refresh Token Rotation** subsection after the existing **Seguridad Implementada** section (or as a sub-section within it). The subsection must:
      - State that only one refresh-token hash is stored per user.
      - Explain that a new login overwrites the stored hash, invalidating previous refresh tokens.
      - Frame this as an intentional simplicity trade-off, not a bug.
      - Provide client-side workaround guidance (e.g., share the refresh token across browser tabs via the same storage mechanism, or plan for re-authentication when switching devices).
      - Avoid implying that multi-device concurrent sessions are supported.
  - Verify the README renders correctly in Markdown preview.

- [x] 8. Final verification and quality gate
  - Run `bun run build` — zero TypeScript errors.
  - Run `bun run lint` — zero Biome violations.
  - Run `bun test` — all unit and integration tests pass.
  - Manual checks:
    - Start in `development`: logs are pretty-printed and human-readable.
    - Start in `production` (or set `NODE_ENV=production`): logs are raw single-line JSON.
    - Send a request without `X-Request-Id`: response contains a generated `X-Request-Id` header.
    - Send a request with `X-Request-Id: custom-id`: response echoes `custom-id`.
    - Send `OPTIONS /api/remisiones`: response contains valid CORS preflight headers.
