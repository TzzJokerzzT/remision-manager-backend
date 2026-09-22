# Apply Progress: remision-search-filters

**Status**: COMPLETE — all 21 tasks (7 phases) implemented, verified, and marked `[x]`.

**Mode**: Strict TDD (RED → GREEN), store `openspec` (filesystem; no Engram).

**Baseline**: 73 tests / 0 fail before any change. Final: 116 tests / 0 fail across 15 files.

## Summary

Added five optional filters to `GET /remisiones` (`clientName`, `driverName`, `type`, `from`, `to`) composing with the existing `companyId`, `search` ($text), and pagination. Names are resolved two-step (name → ids → `$in`) in the application layer; the repository stays a pure filter builder; `total` reflects the fully filtered set via `countDocuments` on the same filter.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/shared/utils/escape-regex.ts` | Created | `escapeRegex(value)` — escapes regex metacharacters (`[.*+?^${}()|[]\\]`) to literal. |
| `src/shared/utils/escape-regex.test.ts` | Created | 4 unit tests (each metacharacter, embedded `a.b`/`a+b`, plain string, empty). |
| `src/application/dtos/remision-list-query.dto.ts` | Created | `remisionListQuerySchema` (no `.passthrough()`) + `RemisionListQueryDTO`. limit/page coercion, trimmed names, `type` enum, ISO `from`/`to` → `Date` (date-only `to` → end-of-day), object `.refine` rejecting `from > to`. |
| `src/application/dtos/remision-list-query.dto.test.ts` | Created | 18 unit tests via `safeParse` (coercion/defaults/trim/type/date/end-of-day/from>to/strip). |
| `src/domain/repositories/IRemisionRepository.ts` | Modified | Added `RemisionListFilters`; `listByOwner(ownerId, filters?, pagination?)`. |
| `src/domain/repositories/IClientRepository.ts` | Modified | Added `findIdsByName(name: string): Promise<string[]>`. |
| `src/domain/repositories/IDriverRepository.ts` | Modified | Added `findIdsByName(name: string): Promise<string[]>`. |
| `src/infrastructure/repositories/ClientRepository.ts` | Modified | Implemented `findIdsByName` (escaped `$regex`/`$options:"i"`, `.select("_id")`, `[]` on empty). |
| `src/infrastructure/repositories/DriverRepository.ts` | Modified | Implemented `findIdsByName` (mirror). |
| `src/infrastructure/repositories/ClientRepository.test.ts` | Modified | +5 `findIdsByName` tests. |
| `src/infrastructure/repositories/DriverRepository.test.ts` | Modified | +5 `findIdsByName` tests. |
| `src/infrastructure/repositories/RemisionRepository.ts` | Modified | `listByOwner(ownerId, filters={}, pagination={20,1})`; combined filter incl. `$in` (guarded on `!== undefined`), `type`, `createdAt` `$gte/$lte`. |
| `src/infrastructure/repositories/RemisionRepository.test.ts` | Rewritten | New signature + `$in`/`type`/date/composition tests (10 total). |
| `src/application/use-cases/remision/RemisionUseCases.ts` | Modified | 4th ctor param `driverRepo`; `listMine(ownerId, query)` resolves names→ids, forwards `RemisionListFilters`; `limit`/`page` destructure defaults. |
| `src/application/use-cases/remision/RemisionUseCases.test.ts` | Rewritten | 4-arg ctor + name-resolution/filter-forwarding/enrichment tests (14 total). |
| `src/di/container.ts` | Modified | `driverRepository` injected as 4th arg. |
| `src/presentation/http/controllers/remision.controller.ts` | Modified | `list` reads `req.query` as `RemisionListQueryDTO` and passes it to `listMine`. |
| `src/presentation/http/routes/remision.routes.ts` | Modified | `GET /` uses `validate(remisionListQuerySchema, "query")`. |

## Verification

- `bun test` → **116 pass / 0 fail** (268 expect calls, 15 files).
- `bun run build` (`tsc --noEmit`) → **clean** (0 errors).
- `biome check .` → repo-wide reports **pre-existing** errors/warnings from prior uncommitted work (the `@/` alias migration + pagination changes already in the working tree). Files authored/changed by this change are biome-clean; the only remaining diagnostic touching this change's file set is `src/di/container.ts` `organizeImports` on the *controller import block*, which predates this change (this change only added the `driverRepository` constructor arg).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | escape-regex.test.ts | Unit | N/A (new) | ✅ module not found | — | — | — |
| 1.2 | escape-regex.test.ts | Unit | — | — | ✅ 4 pass | ✅ 4 cases | ➖ clean |
| 1.3 | remision-list-query.dto.test.ts | Unit | N/A (new) | ✅ module not found | — | — | — |
| 1.4 | remision-list-query.dto.test.ts | Unit | — | — | ✅ 18 pass | ✅ 18 cases | ➖ clean |
| 2.1–2.3 | (interfaces) | — | structural | ➖ type/interface only | — | ➖ single | ➖ none |
| 3.1 | ClientRepository.test.ts | Unit | ✅ 4/4 pre-existing | ✅ method missing (5 fail) | — | — | — |
| 3.2 | ClientRepository.test.ts | Unit | — | — | ✅ 9 pass | ✅ 5 cases | ➖ clean |
| 3.3 | DriverRepository.test.ts | Unit | ✅ 4/4 pre-existing | ✅ method missing (5 fail) | — | — | — |
| 3.4 | DriverRepository.test.ts | Unit | — | — | ✅ 9 pass | ✅ 5 cases | ➖ clean |
| 4.1 | RemisionRepository.test.ts | Unit | ✅ 4/4 pre-existing | ✅ signature mismatch (10 fail) | — | — | — |
| 4.2 | RemisionRepository.test.ts | Unit | — | — | ✅ 10 pass | ✅ 10 cases | ➖ clean |
| 5.1 | RemisionUseCases.test.ts | Unit | ✅ 7/7 pre-existing | ✅ ctor/signature (7 fail) | — | — | — |
| 5.2 | RemisionUseCases.test.ts | Unit | — | — | ✅ 14 pass | ✅ 14 cases | ✅ defaults extracted |
| 6.1–6.3 | (wiring) | — | structural | ➖ no logic | — | — | ➖ none |
| 7.1–7.3 | (verification) | — | — | — | — | — | — |

## Work Unit Evidence

| Evidence | Result |
|----------|--------|
| Focused test command + result | `bun test <per-file>` per RED/GREEN above; final `bun test` → 116 pass / 0 fail |
| Runtime harness | N/A — integration/e2e layers disabled in `openspec/config.yaml` (`integration: false`, `e2e: false`); verified via unit tests + `bun run build` |
| Rollback boundary | Unit 1: delete `escape-regex.ts`/`.test.ts` + `remision-list-query.dto.ts`/`.test.ts`. Unit 2: remove `findIdsByName` from both interfaces + implementations. Unit 3: revert `listByOwner` signature, `RemisionUseCases` ctor/`listMine`, `container.ts`, `remision.controller.ts`, `remision.routes.ts` as one coupled unit. |

## Deviations from Design

1. **`listMine` parameter type is `Partial<RemisionListQueryDTO> = {}`** (design literal: `query: RemisionListQueryDTO = {}`). The design's literal code does not type-check: `RemisionListQueryDTO` infers `limit`/`page` as *required* numbers (`.default()` produces a non-optional output type), so `= {}` and partial-argument calls (`listMine(ownerId, { clientName })`) are TS errors. `Partial<...>` plus destructuring defaults (`limit = 20, page = 1`) is the minimal type-safe realization that preserves default pagination and still accepts the controller's fully-validated object.
2. **`listMine` destructures `limit`/`page` with defaults** (`limit = 20`, `page = 1`) so partial query objects resolve to default pagination (the controller always passes validated values, but direct/unit callers may omit them).
3. **Controller cast is `req.query as unknown as RemisionListQueryDTO`** (design literal: `as RemisionListQueryDTO`). The single cast fails TS2352 (`ParsedQs` → `RemisionListQueryDTO` insufficient overlap) under strict mode; `as unknown as` is the standard safe equivalent.
4. **`RemisionRepository` builds the `createdAt` range as a typed `{ $gte?, $lte? }` local** before assigning to the `Record<string, unknown>` filter, instead of the design's `filter.createdAt = {}; filter.createdAt.$gte = …` (which is illegal on `unknown`).

No behavioral deviation from the spec; all requirements and scenarios are implemented as specified.

## Remaining Tasks

None — all 21 tasks complete. `next_recommended: sdd-archive`.

## Risks / Notes

- **Pre-existing biome debt**: `biome check .` is not repo-clean due to uncommitted prior work (path-alias migration + pagination) already in the working tree. This change introduces no new biome diagnostics.
- **Unindexed `clientId`/`driverId`** (Decision 6): deferred follow-up; `$in` filtering still constrained by indexed `ownerId`.
- **`from > to` rejected at boundary** per tasks.md confirmed resolution (schema `.refine`), though the capability spec has no explicit scenario for it.
