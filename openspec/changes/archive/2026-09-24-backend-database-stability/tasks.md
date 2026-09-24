# Implementation Tasks — backend-database-stability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100–150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | single-pr |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low
```

---

## Capability 1: remision-concurrency-safety

- [x] 1. Create `src/infrastructure/database/models/Counter.model.ts`
  - Add `CounterDocument` interface with `companyId: Schema.Types.ObjectId` (unique, indexed) and `seq: number` (required).
  - Export `CounterModel` using `model<CounterDocument>("Counter", counterSchema)`.
  - Verify `bun run build` compiles the new file with no lint or type errors.

- [x] 2. Add atomic `getNextConsecutive` to `src/infrastructure/repositories/RemisionRepository.ts`
  - Import `CounterModel` from `../database/models/Counter.model.js`.
  - Replace the old `getNextConsecutive` body with the four-path logic from the design: fast-path `$inc`, seed fallback using `RemisionModel.findOne(...).sort(...).select(...).lean()`, `CounterModel.create`, and duplicate-key (`code === 11000`) retry.
  - Ensure the existing compound unique index on `(companyId, consecutive)` in `Remision.model.ts` remains unchanged as a safety net.

- [x] 3. Add counter unit tests to `src/infrastructure/repositories/RemisionRepository.test.ts`
  - Mock `CounterModel.findOneAndUpdate` and `CounterModel.create`; add corresponding `mockReset` calls in `beforeEach`.
  - Add `findOne` to the existing `RemisionModel` mock (or chain it onto the query mock) so the seed-fallback path can be exercised.
  - Add a `describe("RemisionRepository.getNextConsecutive", ...)` block with four tests:
    - increments existing counter and returns new seq.
    - seeds counter from last remision when counter is missing.
    - starts at 1 when no counter and no remisiones exist.
    - retries atomic increment on duplicate-key race during seed.
  - Run `bun test src/infrastructure/repositories/RemisionRepository.test.ts` and confirm all tests pass (RED → GREEN → REFACTOR).

---

## Capability 2: database-connection-reliability

- [x] 4. Update `src/index.ts` for eager connection and graceful shutdown
  - Import `disconnectDatabase` from `./infrastructure/database/mongoose.js`.
  - Replace the conditional `.then()` boot with an async IIFE that:
    - `await connectDatabase()` before `app.listen()`.
    - Stores the `server` return value from `listen()`.
    - Registers `SIGTERM` and `SIGINT` handlers that call `server.close()`, then `await disconnectDatabase()`, then `process.exit(0)`.
    - Enforces a 5-second hard timeout (`setTimeout(() => process.exit(1), 5000)`) that is cleared on successful shutdown.
  - Ensure `export default app` stays at module top level for Vercel compatibility.

- [x] 5. Update `src/presentation/http/server.ts` to remove lazy-connect middleware and implement `/health`
  - Remove the `connectDatabase` import.
  - Remove the `dbReady` flag and the `app.use(async ...)` lazy-connect middleware block.
  - Replace the stub `/health` handler with a `mongoose.connection.readyState` check:
    - Return `200` + `{ status: "ok", db: "connected" }` when `readyState === 1`.
    - Return `503` + `{ status: "degraded", db: "disconnected" }` otherwise.
  - Import `mongoose` if not already imported.

---

## Verification

- [x] 6. Run full build and test suite
  - Execute `bun run build` and confirm zero TypeScript errors.
  - Execute `bun test` and confirm all existing tests plus new counter tests pass.
  - Spot-check that no `dbReady` references remain in the codebase (`grep -r "dbReady" src/`).
