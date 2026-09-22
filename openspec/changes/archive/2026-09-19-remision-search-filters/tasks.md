# Tasks: Remision List Search and Filters

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–650 (18 files: 4 new, 14 modified) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (foundation) → PR 2 (name-id resolution) → PR 3 (filter construction + wiring) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium
```

> Confirmed resolutions baked into the tasks below:
> - `from > to` → rejected with `422` (added via an object-level `.refine` on `remisionListQuerySchema`).
> - `companyId` stays an optional **trimmed string** (backward compatible; NOT tightened to a MongoId regex).
> - `clientId`/`driverId` indexes are **deferred** to a separate follow-up — NOT part of this change (no `src/infrastructure/database/models/Remision.model.ts` edits).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundation: `escapeRegex` helper + `remisionListQuerySchema` DTO (pure, additive, no coupling) | PR 1 | `bun test src/shared/utils/escape-regex.test.ts src/application/dtos/remision-list-query.dto.test.ts` | N/A — integration/e2e layers disabled in `openspec/config.yaml`; verified via unit tests + `bun run build` | Delete the 4 new files (`escape-regex.ts`, `escape-regex.test.ts`, `remision-list-query.dto.ts`, `remision-list-query.dto.test.ts`) — nothing else references them yet |
| 2 | Name-id resolution: add `findIdsByName` to `IClientRepository`/`IDriverRepository` + implementations (additive; does NOT touch `listByOwner`) | PR 2 | `bun test src/infrastructure/repositories/ClientRepository.test.ts src/infrastructure/repositories/DriverRepository.test.ts` | N/A — integration/e2e layers disabled; verified via unit tests + `bun run build` | Remove the `findIdsByName` method from both interfaces + implementations (additive method, no existing call sites) |
| 3 | Filter construction + orchestration + wiring: `RemisionListFilters`, `listByOwner` signature change, `RemisionUseCases` constructor/`listMine`, DI, controller, routes | PR 3 | `bun test src/infrastructure/repositories/RemisionRepository.test.ts src/application/use-cases/remision/RemisionUseCases.test.ts && bun run build` | N/A — integration/e2e layers disabled; verified via unit tests + `bun run build` | Revert `listByOwner` signature, `RemisionUseCases` constructor/`listMine`, `container.ts`, `remision.controller.ts`, `remision.routes.ts` as one unit (they are coupled) |

> If `feature-branch-chain` is chosen: PR #1 base = feature/tracker branch; PR #2 base = PR #1 branch; PR #3 base = PR #2 branch. If a child PR shows previous-slice changes in its diff, retarget/rebase until the diff is clean.

## Phase 1: Foundation — pure helpers + DTO (test-first)

- [x] 1.1 **RED** — Create `src/shared/utils/escape-regex.test.ts` with `bun:test` cases: each regex metacharacter in `` `.*+?^${}()|[]\` `` is escaped to a literal (assert the returned string contains `\` before the metacharacter); a plain string (no metacharacters) is returned unchanged. Run `bun test src/shared/utils/escape-regex.test.ts` → expect failure (module not found).
- [x] 1.2 **GREEN** — Create `src/shared/utils/escape-regex.ts` exporting `escapeRegex(value: string): string` implemented as `` value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ``. Re-run the focused test → expect pass.
- [x] 1.3 **RED** — Create `src/application/dtos/remision-list-query.dto.test.ts` covering, via `safeParse` (never `expect().toThrow` for negatives): `limit`/`page` coerce from string and default to `20`/`1`; `limit > 100` rejected; non-integer `limit`/`page` rejected; `clientName`/`driverName` trimmed and whitespace-only → `undefined` (absent); `type` accepts `priced`/`quantity_only` and rejects `invalid`; `from`/`to` accept ISO date (`2026-01-01`) and ISO datetime, reject `not-a-date` and `2026-13-99`; date-only `to=2026-01-31` → `Date` at `2026-01-31T23:59:59.999Z` (end-of-day); **`from > to` rejected** (confirmed resolution); `companyId` preserved as a trimmed string (not MongoId-validated); unknown query keys are stripped (no `.passthrough()` leak). Run `bun test src/application/dtos/remision-list-query.dto.test.ts` → expect failure (module not found).
- [x] 1.4 **GREEN** — Create `src/application/dtos/remision-list-query.dto.ts` exporting `remisionListQuerySchema` (Zod object, **no `.passthrough()`**) and `type RemisionListQueryDTO = z.infer<...>`. Include: `limit`/`page` with identical rules to `paginationQuerySchema` (positive int, `limit ≤ 100`, defaults `20`/`1`); `companyId: z.string().trim().optional()`; `search: z.string().trim().optional()`; `clientName`/`driverName` via an `optionalTrimmedName` preprocess (trim; whitespace-only → `undefined`); `type: z.enum(["priced", "quantity_only"]).optional()`; `from`/`to` as ISO-string sub-schemas validated with an allowlist regex (`YYYY-MM-DD` or ISO datetime) **and** `!Number.isNaN(Date.parse(v))` (NOT `z.coerce.date()`), `.transform()` to `Date` with date-only `to` bumped to end-of-day UTC; and an object-level `.refine` rejecting `from > to` (message surfaces as 422). Re-run the focused test → expect pass.

## Phase 2: Repository contracts (interfaces)

- [x] 2.1 Modify `src/domain/repositories/IRemisionRepository.ts` — export a new `RemisionListFilters` interface (`companyId?`, `search?`, `clientIds?`, `driverIds?`, `type?: Remision["type"]`, `from?: Date`, `to?: Date`) and change `listByOwner` to `(ownerId: string, filters?: RemisionListFilters, pagination?: { limit: number; page: number })`. Import `Remision` from `@/domain/entities/Remision.js` if not already present.
- [x] 2.2 Modify `src/domain/repositories/IClientRepository.ts` — add `findIdsByName(name: string): Promise<string[]>;`.
- [x] 2.3 Modify `src/domain/repositories/IDriverRepository.ts` — add `findIdsByName(name: string): Promise<string[]>;`.

## Phase 3: Name-id resolution (Client/Driver repositories, test-first)

- [x] 3.1 **RED** — Extend `src/infrastructure/repositories/ClientRepository.test.ts` with `findIdsByName` tests (mirroring the existing `vi.mock` Mongoose model pattern): calls `ClientModel.find` with `{ name: { $regex: <escaped>, $options: "i" } }` and `.select("_id")`; input `a.b` / `a+b` is escaped (metacharacters literal); case-insensitive substring match; empty/whitespace input returns `[]` without querying; returns `_id` strings only. Run `bun test src/infrastructure/repositories/ClientRepository.test.ts` → expect failure (method missing).
- [x] 3.2 **GREEN** — Implement `findIdsByName` in `src/infrastructure/repositories/ClientRepository.ts`: trim input, return `[]` on empty, query `ClientModel.find({ name: { $regex: escapeRegex(trimmed), $options: "i" } }).select("_id")`, map to `doc.id.toString()`. Import `escapeRegex` from `@/shared/utils/escape-regex.js`. Re-run → expect pass.
- [x] 3.3 **RED** — Extend `src/infrastructure/repositories/DriverRepository.test.ts` with `findIdsByName` tests (mirror of 3.1 against `DriverModel`). Run → expect failure.
- [x] 3.4 **GREEN** — Implement `findIdsByName` in `src/infrastructure/repositories/DriverRepository.ts` (identical to client, querying `DriverModel`). Re-run → expect pass.

## Phase 4: Remision filter construction (test-first)

- [x] 4.1 **RED** — Update `src/infrastructure/repositories/RemisionRepository.test.ts` to call `listByOwner(ownerId, filters, pagination)` and add tests asserting the built filter passed to **both** `RemisionModel.find` and `RemisionModel.countDocuments`: `clientIds: []` produces `clientId: { $in: [] }` (NOT omitted — empty match); `driverIds` produces `driverId: { $in: driverIds }`; `type` sets `filter.type`; `from`/`to` set `filter.createdAt` `$gte`/`$lte`; existing `companyId`/`search`/`$text`/ownerId behavior preserved. Run `bun test src/infrastructure/repositories/RemisionRepository.test.ts` → expect failure (signature changed).
- [x] 4.2 **GREEN** — Rewrite `RemisionRepository.listByOwner` in `src/infrastructure/repositories/RemisionRepository.ts` to accept `(ownerId, filters = {}, pagination = { limit: 20, page: 1 })` and build the combined `Record<string, unknown>` filter: `ownerId`; `companyId` if truthy; `$text` if `search` non-empty; **guard `clientIds !== undefined` (NOT `.length > 0`)** → `filter.clientId = { $in: clientIds }`; `driverIds !== undefined` → `filter.driverId = { $in: driverIds }`; `type !== undefined` → `filter.type`; `from`/`to` → `filter.createdAt = { $gte?, $lte? }`. Keep the existing `find`/`sort`(textScore vs createdAt)/`skip`/`limit`/`countDocuments(filter)` flow unchanged. Re-run → expect pass.

## Phase 5: Use case orchestration (test-first)

- [x] 5.1 **RED** — Update `src/application/use-cases/remision/RemisionUseCases.test.ts`: add a fake `driverRepo` to the constructor; update `listMine` calls to the new query-object shape; add tests for — `clientName` present → calls `clientRepo.findIdsByName` and passes resulting `clientIds` into `listByOwner`; `driverName` present → calls `driverRepo.findIdsByName`; names absent → skips resolution (`clientIds`/`driverIds` undefined); `type`/`from`/`to` forwarded; composition with `companyId`/`search`; clientName enrichment unchanged. Run `bun test src/application/use-cases/remision/RemisionUseCases.test.ts` → expect failure (constructor/signature changed).
- [x] 5.2 **GREEN** — Update `src/application/use-cases/remision/RemisionUseCases.ts`: add `IDriverRepository` as the 4th constructor param; change `listMine(ownerId, query: RemisionListQueryDTO = {})` to destructure filters, resolve `clientIds`/`driverIds` via `findIdsByName` (only when the name is `!== undefined`), build a `RemisionListFilters` object, call `remisionRepo.listByOwner(ownerId, filters, { limit, page })`, then keep the existing `clientRepo.findByIds` enrichment + `buildPaginationResponse` path unchanged. Re-run → expect pass.

## Phase 6: Integration / Wiring

- [x] 6.1 Modify `src/di/container.ts` — inject `driverRepository` as the 4th argument to `new RemisionUseCases(remisionRepository, companyRepository, clientRepository, driverRepository)`.
- [x] 6.2 Modify `src/presentation/http/controllers/remision.controller.ts` — in `list`, replace the manual `req.query` parsing with `const query = req.query as RemisionListQueryDTO;` and call `this.remisionUseCases.listMine(req.user!.id, query)`. Import `RemisionListQueryDTO` from `@/application/dtos/remision-list-query.dto.js`.
- [x] 6.3 Modify `src/presentation/http/routes/remision.routes.ts` — change `GET /` from `validate(paginationQuerySchema, "query")` to `validate(remisionListQuerySchema, "query")`; import `remisionListQuerySchema` from `@/application/dtos/remision-list-query.dto.js` and drop the now-unused `paginationQuerySchema` import.

## Phase 7: Verification / Build

- [x] 7.1 Run `bun test` — full suite GREEN (all new/updated unit tests pass; no regressions in the other repos/use-cases).
- [x] 7.2 Run `bun run build` — TypeScript compiles cleanly across the changed interfaces and consumers (no missed `listByOwner`/constructor call sites).
- [x] 7.3 Run `biome check .` — lint/format clean (tab indentation, double quotes preserved). NOTE: repo-wide biome reports pre-existing errors from prior uncommitted work (`@/` alias migration + pagination); the files authored/changed by this change are biome-clean.
