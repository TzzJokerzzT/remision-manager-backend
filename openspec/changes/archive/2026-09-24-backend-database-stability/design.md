# Design: backend-database-stability

## Scope

Three capabilities that fix active production race conditions and improve operational reliability:

1. **database-connection-reliability** — eager DB connect, remove lazy `dbReady` middleware, SIGTERM/SIGINT graceful shutdown (5 s timeout).
2. **remision-concurrency-safety** — atomic consecutive number generation via a dedicated counter collection (`findOneAndUpdate` with `$inc`).
3. **health-monitoring** — `/health` inspects `mongoose.connection.readyState`; returns 200/503.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Counter collection (not unique-index retry) | `findOneAndUpdate` + `$inc` on a dedicated document is strictly atomic in MongoDB, requires no retry loop, and keeps the allocation logic in one place. The existing unique compound index on `(companyId, consecutive)` is kept as a safety net. |
| 2 | Inline counter seeding on first access | The repository handles a missing counter by falling back to `max(consecutive)+1` from the `Remision` collection, then creates the counter document. This is self-healing and avoids a mandatory deployment-time migration script. |
| 3 | Graceful shutdown timeout = 5 s | Matches Vercel serverless function lifecycle limits. In local/Docker runs it still gives in-flight requests a bounded window to finish. |
| 4 | Health check reads `mongoose.connection.readyState` only | Zero-cost; no DB query or reconnect attempt. Returns 503 when `readyState !== 1`. |
| 5 | `index.ts` wraps boot in async IIFE | Preserves the existing non-blocking module shape and keeps `export default app` at the top level for Vercel compatibility. |
| 6 | No new runtime dependencies | All changes use `mongoose` and `express` already in `package.json`. |

---

## Architecture

### Boot & Shutdown Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   index.ts  │────▶│ connectDatabase()│────▶│ app.listen()    │
│  (entry)    │     │  (eager, once)   │     │  (HTTP server)  │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │                           │
                           ▼                           ▼
                    ┌─────────────┐            ┌─────────────┐
                    │  MongoDB    │            │ SIGTERM /   │
                    │  connected  │            │ SIGINT      │
                    └─────────────┘            └──────┬──────┘
                                                      │
                       ┌──────────────────────────────┘
                       ▼
              ┌─────────────────┐
              │ server.close()  │  ◄── stop accepting new connections
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │disconnectDatabase│ ◄── close mongoose connection
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ process.exit(0) │ ◄── or exit(1) after 5 s timeout
              └─────────────────┘
```

### Consecutive Number Generation Flow

```
RemisionUseCases.create()
         │
         ▼
RemisionRepository.getNextConsecutive(companyId)
         │
         ├─▶ CounterModel.findOneAndUpdate({ companyId }, { $inc: { seq: 1 } })
         │           │
         │           ├─ counter exists ──▶ return seq
         │           │
         │           └─ counter missing ──▶ fallback:
         │                                   RemisionModel.findOne({ companyId })
         │                                   .sort({ consecutive: -1 })
         │                                   next = max + 1
         │                                   CounterModel.create({ companyId, seq: next })
         │                                   (race-safe: duplicate-key → retry $inc)
         │
         ▼
   RemisionModel.create({ ..., consecutive })
         │
         ▼
   unique index (companyId, consecutive) ── safety net
```

---

## File Changes

### 1. `src/presentation/http/server.ts`

**Remove** the lazy-connect middleware block:

```typescript
// DELETE:
let dbReady = false;
app.use(async (_req, _res, next) => {
  if (!dbReady) {
    await connectDatabase();
    dbReady = true;
  }
  next();
});
```

**Remove** the `connectDatabase` import (no longer used in this file).

**Replace** the stub `/health` handler:

```typescript
import mongoose from "mongoose";

// BEFORE:
app.get("/health", (_req, res) => res.json({ success: true, status: "ok" }));

// AFTER:
app.get("/health", (_req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    return res.status(200).json({ status: "ok", db: "connected" });
  }
  return res.status(503).json({ status: "degraded", db: "disconnected" });
});
```

**Rationale**: Removing the middleware eliminates the per-request `dbReady` flag and the implicit lazy connection. The health endpoint now reports actual DB state with no heavy operations.

---

### 2. `src/index.ts`

**Replace** the current conditional boot sequence:

```typescript
// BEFORE:
if (process.env.VERCEL !== "1") {
  connectDatabase().then(() => {
    app.listen(env.PORT, () => {
      console.log(`🚀 Servidor en http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    });
  });
}

// AFTER:
if (process.env.VERCEL !== "1") {
  (async () => {
    try {
      await connectDatabase();
      const server = app.listen(env.PORT, () => {
        console.log(`🚀 Servidor en http://localhost:${env.PORT} [${env.NODE_ENV}]`);
      });

      const gracefulShutdown = (signal: string) => {
        console.log(`\n${signal} received. Closing HTTP server...`);
        const forceExit = setTimeout(() => {
          console.error("Shutdown timeout exceeded (5s). Forcing exit.");
          process.exit(1);
        }, 5000);

        server.close(async () => {
          await disconnectDatabase();
          clearTimeout(forceExit);
          process.exit(0);
        });
      };

      process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
      process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    } catch {
      process.exit(1);
    }
  })();
}
```

**Add** `disconnectDatabase` to the import from `mongoose.js`.

**Rationale**: Eager connection before `listen()` guarantees the server never accepts traffic without a DB. The async IIFE preserves `export default app` at module top level for Vercel. Shutdown handlers close the HTTP server first (draining in-flight requests), then the DB connection, with a hard 5 s kill switch.

---

### 3. `src/infrastructure/database/models/Counter.model.ts` (NEW)

```typescript
import { model, Schema } from "mongoose";

export interface CounterDocument {
  companyId: Schema.Types.ObjectId;
  seq: number;
}

const counterSchema = new Schema<CounterDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    seq: { type: Number, required: true },
  },
  { strict: true },
);

export const CounterModel = model<CounterDocument>("Counter", counterSchema);
```

**Rationale**: Dedicated counter collection isolates the sequence state from remision document lifecycles (deletions do not reset the counter). `companyId` uses `ObjectId` to stay consistent with `Remision.model.ts`.

---

### 4. `src/infrastructure/repositories/RemisionRepository.ts`

**Add** import:

```typescript
import { CounterModel } from "../database/models/Counter.model.js";
```

**Replace** `getNextConsecutive`:

```typescript
// BEFORE:
async getNextConsecutive(companyId: string): Promise<number> {
  const last = await RemisionModel.findOne({ companyId })
    .sort({ consecutive: -1 })
    .select("consecutive");
  return (last?.consecutive ?? 0) + 1;
}

// AFTER:
async getNextConsecutive(companyId: string): Promise<number> {
  // Fast path: atomically increment an existing counter.
  const existing = await CounterModel.findOneAndUpdate(
    { companyId },
    { $inc: { seq: 1 } },
    { new: true, lean: true },
  );
  if (existing) {
    return existing.seq;
  }

  // Seed path: first access for this company (handles existing data migration).
  const last = await RemisionModel.findOne({ companyId })
    .sort({ consecutive: -1 })
    .select("consecutive")
    .lean();
  const nextSeq = (last?.consecutive ?? 0) + 1;

  try {
    await CounterModel.create({ companyId, seq: nextSeq });
    return nextSeq;
  } catch (err: unknown) {
    // Race: another request created the counter. Retry the atomic increment.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === 11000
    ) {
      const retry = await CounterModel.findOneAndUpdate(
        { companyId },
        { $inc: { seq: 1 } },
        { new: true, lean: true },
      );
      if (!retry) {
        throw new Error("Counter race retry failed unexpectedly");
      }
      return retry.seq;
    }
    throw err;
  }
}
```

**Rationale**: `$inc` is atomic at the MongoDB document level, so concurrent requests for the same company always receive distinct values. The seeding fallback ensures zero-downtime migration from the old non-atomic scheme without a manual deployment script. The unique compound index already present on `Remision.model.ts` (`companyId: 1, consecutive: 1`) acts as a final safety net.

---

### 5. `src/infrastructure/repositories/RemisionRepository.test.ts`

**Add** mock for the new counter model at the top of the file (inside the `vi.mock` block or as a separate mock):

```typescript
vi.mock("../database/models/Counter.model.js", () => ({
  CounterModel: {
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

import { CounterModel } from "../database/models/Counter.model.js";
const counterFindOneAndUpdateMock =
  CounterModel.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;
const counterCreateMock =
  CounterModel.create as unknown as ReturnType<typeof vi.fn>;
```

**Add** reset in `beforeEach`:

```typescript
counterFindOneAndUpdateMock.mockReset();
counterCreateMock.mockReset();
```

**Add** new describe blocks:

```typescript
describe("RemisionRepository.getNextConsecutive", () => {
  test("increments existing counter and returns new seq", async () => {
    counterFindOneAndUpdateMock.mockResolvedValue({ seq: 7 });

    const repo = new RemisionRepository();
    const result = await repo.getNextConsecutive("comp1");

    expect(counterFindOneAndUpdateMock).toHaveBeenCalledWith(
      { companyId: "comp1" },
      { $inc: { seq: 1 } },
      { new: true, lean: true },
    );
    expect(result).toBe(7);
  });

  test("seeds counter from last remision when counter missing", async () => {
    counterFindOneAndUpdateMock.mockResolvedValue(null);
    counterCreateMock.mockResolvedValue({});

    const lastQuery = makeQuery([makeDoc("id1")]);
    findMock.mockReturnValue(lastQuery);

    const repo = new RemisionRepository();
    const result = await repo.getNextConsecutive("comp1");

    expect(result).toBe(2); // makeDoc has consecutive: 1
    expect(counterCreateMock).toHaveBeenCalledWith({
      companyId: "comp1",
      seq: 2,
    });
  });

  test("starts at 1 when no counter and no remisiones exist", async () => {
    counterFindOneAndUpdateMock.mockResolvedValue(null);
    counterCreateMock.mockResolvedValue({});

    const emptyQuery = makeQuery([]);
    findMock.mockReturnValue(emptyQuery);

    const repo = new RemisionRepository();
    const result = await repo.getNextConsecutive("comp1");

    expect(result).toBe(1);
    expect(counterCreateMock).toHaveBeenCalledWith({
      companyId: "comp1",
      seq: 1,
    });
  });

  test("retries atomic increment on duplicate-key race during seed", async () => {
    counterFindOneAndUpdateMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ seq: 5 });
    const dupError = Object.assign(new Error("duplicate key"), { code: 11000 });
    counterCreateMock.mockRejectedValue(dupError);

    const emptyQuery = makeQuery([]);
    findMock.mockReturnValue(emptyQuery);

    const repo = new RemisionRepository();
    const result = await repo.getNextConsecutive("comp1");

    expect(result).toBe(5);
    expect(counterFindOneAndUpdateMock).toHaveBeenCalledTimes(2);
  });
});
```

**Rationale**: Covers the four code paths (fast, seed-from-existing, seed-from-zero, race-retry) using the existing mock-based unit-test conventions.

---

## Data Flow Summary

| Capability | Input | Processing | Output |
|------------|-------|------------|--------|
| database-connection-reliability | Process start / SIGTERM / SIGINT | `connectDatabase()` before `listen()`; `server.close()` → `disconnectDatabase()` → `process.exit()` | Healthy boot; clean shutdown within 5 s |
| remision-concurrency-safety | `companyId` string | `CounterModel.findOneAndUpdate({ companyId }, { $inc: { seq: 1 } })` with seed fallback | Unique, monotonic `consecutive` integer |
| health-monitoring | `GET /health` | Read `mongoose.connection.readyState` | `200 { status: "ok", db: "connected" }` or `503 { status: "degraded", db: "disconnected" }` |

---

## Test Plan

| Test | Type | Where |
|------|------|-------|
| `getNextConsecutive` increments existing counter | Unit | `RemisionRepository.test.ts` |
| `getNextConsecutive` seeds from last remision | Unit | `RemisionRepository.test.ts` |
| `getNextConsecutive` starts at 1 for new company | Unit | `RemisionRepository.test.ts` |
| `getNextConsecutive` handles duplicate-key race | Unit | `RemisionRepository.test.ts` |
| `/health` returns 200 when `readyState === 1` | Unit (route-level) | New or existing server test |
| `/health` returns 503 when `readyState !== 1` | Unit (route-level) | New or existing server test |
| Concurrent inserts for same company yield unique consecutives | Integration | Deferred to `backend-testing-pipeline` (requires `mongodb-memory-server`) |
| Graceful shutdown closes server and DB | Integration | Deferred to `backend-testing-pipeline` |

All existing unit tests must continue to pass (`bun test`).

---

## Rollback

1. Revert `server.ts` — restore `dbReady` middleware and stub `/health`.
2. Revert `index.ts` — remove shutdown handlers and `disconnectDatabase` import; restore `.then()` boot.
3. Revert `RemisionRepository.ts` — restore old `getNextConsecutive`.
4. Delete `Counter.model.ts`.
5. Revert `RemisionRepository.test.ts` — remove counter mocks and new test cases.
6. Run `bun run build` and `bun test`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing companies hit duplicate-key on first create because counter starts unseeded | Low | High | Inline seeding fallback in `getNextConsecutive` computes `max+1` from existing remisiones before creating the counter. |
| Graceful shutdown never fires on Vercel serverless | Med | Low | Handlers are implemented for local/Docker; Vercel reaps the function process automatically. Timeout is 5 s to match platform limits. |
| Counter document creation races between two first-ever requests | Low | Med | Duplicate-key error handler retries the atomic `$inc` once. Unique index on `Remision` is the final backstop. |
| Build size / lint errors from new import paths | Low | Low | Project already uses `.js` extensions and `paths: { "@/*": ["src/*"] }`; no new deps. |

---

## Dependencies on Other Changes

- `health-monitoring` depends on `database-connection-reliability` (same connection state).
- `backend-testing-pipeline` (follow-up change) will add integration tests for concurrent consecutive safety and graceful shutdown using `mongodb-memory-server`.
