# Tasks: Add Pagination to List Endpoints

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700 lines (21 modified + 9 new test files across 4 domains) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (foundation + remision domain) → PR 2 (company/client/driver domains) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundation DTO schema + `buildPaginationResponse` helper + remision domain threaded end-to-end (`GET /remisiones` returns paginated `data`) | PR 1 | `bun test src/application/dtos/pagination.dto.test.ts src/infrastructure/repositories/RemisionRepository.test.ts src/application/use-cases/remision/RemisionUseCases.test.ts` | `bun run build` (type check) + scoped `bun test`; live runtime N/A (`integration: false`, no DB) | Revert `src/application/dtos/pagination.dto.ts` additions + remision interface/impl/use-case/controller/route; delete 3 test files. The other 3 domains remain untouched and keep compiling |
| 2 | company/client/driver domains threaded end-to-end (remaining 3 list endpoints return paginated `data`) | PR 2 | `bun test src/infrastructure/repositories/CompanyRepository.test.ts src/infrastructure/repositories/ClientRepository.test.ts src/infrastructure/repositories/DriverRepository.test.ts src/application/use-cases/company/CompanyUseCases.test.ts src/application/use-cases/client/ClientUseCases.test.ts src/application/use-cases/driver/DriverUseCases.test.ts` | `bun run build` (type check) + full `bun test`; live runtime N/A (`integration: false`) | Revert company/client/driver interface/impl/use-case/controller/route; delete 6 test files. Depends on Unit 1's shared `paginationQuerySchema`/`buildPaginationResponse`, which stays in place |

## Phase 1: Foundation — Pagination DTO schema + response builder (test-first)

- [x] 1.1 **RED** — Create `src/application/dtos/pagination.dto.test.ts`. Cover `paginationQuerySchema` with `bun:test` `safeParse` assertions: coercion (`"10"`→`10`, `"2"`→`2`), defaults (absent → `limit=20`, `page=1`), bounds/rejections (non-numeric `abc`, negative `-5`/`-1`, zero `0`, non-integer `10.5`/`2.5`, `limit=500` above `.max(100)`), and `.passthrough()` preserving `search`/`companyId` keys. Follow the conventions of `src/application/dtos/remision.dto.test.ts` (read-only): relative imports with `.js` extension, no mongoose, no `process.env`, no network/timers/filesystem. Verify: `bun test src/application/dtos/pagination.dto.test.ts` fails (RED).
- [x] 1.2 **RED** — Add `buildPaginationResponse` `totalPages` scenarios to `src/application/dtos/pagination.dto.test.ts` before the helper exists: exact division (`40/20`→`2`), remainder rounds up (`45/20`→`3`), zero total (`0/20`→`0`), `limit > total` (`5/20`→`1`), and full DTO shape keys (`items`, `total`, `limit`, `page`, `totalPages`). Verify: same command still fails (RED).
- [x] 1.3 **GREEN** — Extend `src/application/dtos/pagination.dto.ts`. Add `paginationQuerySchema = z.object({ limit: z.coerce.number().int().positive().max(100).default(20), page: z.coerce.number().int().positive().default(1) }).passthrough()` and export `buildPaginationResponse<T>(items, total, limit, page): PaginationResponseDTO<T>` computing `totalPages = Math.ceil(total / limit)`. Keep the existing `PaginationDTO` / `PaginationResponseDTO<T>` interfaces untouched. Verify: `bun test src/application/dtos/pagination.dto.test.ts` passes (GREEN).

## Phase 2: Remision domain end-to-end (test-first)

- [x] 2.1 **RED** — Create `src/infrastructure/repositories/RemisionRepository.test.ts`. Use `bun:test` + `vi.mock` of `../database/models/Remision.model.js` to assert, with no real DB: `.skip((page-1)*limit)` and `.limit(limit)` args on the find chain; `countDocuments(filter)` receives the **same** filter (including `$text` when `search` present); `{ items, total }` assembly via `toDomain`; empty result → `{ items: [], total: 0 }`; page beyond last → empty `items` with correct `total`. Verify: `bun test src/infrastructure/repositories/RemisionRepository.test.ts` fails (RED — current `listByOwner` returns `Remision[]`, not `{ items, total }`).
- [x] 2.2 **RED** — Create `src/application/use-cases/remision/RemisionUseCases.test.ts`. Inject a fake `IRemisionRepository` (no mongoose) returning `{ items, total }`, and assert `listMine(ownerId, companyId, search, { limit, page })` returns a `PaginationResponseDTO<Remision>` with correct `limit`, `page`, and `totalPages`. Verify: fails (RED — `listMine` currently returns `Remision[]`).
- [x] 2.3 **GREEN** — Change `src/domain/repositories/IRemisionRepository.ts` so `listByOwner(ownerId: string, companyId?: string, search?: string, pagination: { limit: number; page: number })` returns `Promise<{ items: Remision[]; total: number }>`. Use the inline `{ limit; page }` shape — do NOT import `PaginationDTO` from the application layer. Verify: type check still passes for interface consumers after 2.4–2.7 land.
- [x] 2.4 **GREEN** — Change `src/infrastructure/repositories/RemisionRepository.ts` `listByOwner` to derive `skip = (pagination.page - 1) * pagination.limit`, apply `.skip(skip).limit(pagination.limit)` to the existing `find` query, and run `countDocuments(filter)` against the same `filter` (via `Promise.all`), returning `{ items: docs.map(toDomain), total }`. Verify: `bun test src/infrastructure/repositories/RemisionRepository.test.ts` passes.
- [x] 2.5 **GREEN** — Change `src/application/use-cases/remision/RemisionUseCases.ts` `listMine` to accept `pagination: PaginationDTO = { limit: 20, page: 1 }`, call `this.remisionRepo.listByOwner(ownerId, companyId, search, pagination)`, and return `buildPaginationResponse(items, total, pagination.limit, pagination.page)`. Import `PaginationDTO`/`PaginationResponseDTO`/`buildPaginationResponse` from `../../dtos/pagination.dto.js`. Verify: `bun test src/application/use-cases/remision/RemisionUseCases.test.ts` passes.
- [x] 2.6 **GREEN** — Change `src/presentation/http/controllers/remision.controller.ts` `list` to read the coerced `req.query.limit`/`req.query.page` (numbers after `validate`) and pass `{ limit, page }` to `listMine`, keeping the existing `companyId`/`search` string guards. The paginated object is already assigned to `data` in the `{ success, data, message }` envelope. Verify: controller compiles and `data` is the paginated object.
- [x] 2.7 **GREEN** — Change `src/presentation/http/routes/remision.routes.ts` `GET /` to `router.get("/", validate(paginationQuerySchema, "query"), controller.list)`, importing `paginationQuerySchema` from `../../../application/dtos/pagination.dto.js`. Verify: `GET /remisiones?limit=10&page=2` validates (integration deferred per `integration: false`).

## Phase 3: Remaining domains — company/client/driver (test-first)

### Company (asymmetric: `listByOwner(ownerId, search?)` — no `companyId`)

- [x] 3.1 **RED** — Create `src/infrastructure/repositories/CompanyRepository.test.ts` with `vi.mock` of `../database/models/Company.model.js`, asserting skip/limit args and `countDocuments(filter)` against the `(ownerId, search?)` filter. Verify: fails (RED).
- [x] 3.2 **RED** — Create `src/application/use-cases/company/CompanyUseCases.test.ts` with a fake `ICompanyRepository`, asserting `listMine` wires `{ items, total }` → `PaginationResponseDTO<Company>`. Verify: fails (RED).
- [x] 3.3 **GREEN** — Change `src/domain/repositories/ICompanyRepository.ts` `listByOwner(ownerId: string, search?: string, pagination: { limit: number; page: number })` → `Promise<{ items: Company[]; total: number }>`.
- [x] 3.4 **GREEN** — Change `src/infrastructure/repositories/CompanyRepository.ts` `listByOwner` to apply `.skip()/.limit()` + `countDocuments(filter)` and return `{ items, total }`.
- [x] 3.5 **GREEN** — Change `src/application/use-cases/company/CompanyUseCases.ts` `listMine` to accept `pagination` and return `buildPaginationResponse(...)`.
- [x] 3.6 **GREEN** — Change `src/presentation/http/controllers/company.controller.ts` `list` to read coerced `limit`/`page` and pass pagination to `listMine`.
- [x] 3.7 **GREEN** — Change `src/presentation/http/routes/company.routes.ts` `GET /` to add `validate(paginationQuerySchema, "query")`.

### Client (mirrors remision: `listByOwner(ownerId, companyId?, search?)`)

- [x] 3.8 **RED** — Create `src/infrastructure/repositories/ClientRepository.test.ts` with `vi.mock` of `../database/models/Client.model.js`, asserting skip/limit + `countDocuments(filter)` against the `(ownerId, companyId?, search?)` filter. Verify: fails (RED).
- [x] 3.9 **RED** — Create `src/application/use-cases/client/ClientUseCases.test.ts` with a fake `IClientRepository`, asserting `listMine` wires `{ items, total }` → `PaginationResponseDTO<Client>`. Verify: fails (RED).
- [x] 3.10 **GREEN** — Change `src/domain/repositories/IClientRepository.ts` `listByOwner(ownerId, companyId?, search?, pagination)` → `Promise<{ items: Client[]; total: number }>`.
- [x] 3.11 **GREEN** — Change `src/infrastructure/repositories/ClientRepository.ts` `listByOwner` to apply `.skip()/.limit()` + `countDocuments(filter)` and return `{ items, total }`.
- [x] 3.12 **GREEN** — Change `src/application/use-cases/client/ClientUseCases.ts` `listMine` to accept `pagination` and return `buildPaginationResponse(...)`.
- [x] 3.13 **GREEN** — Change `src/presentation/http/controllers/client.controller.ts` `list` to read coerced `limit`/`page` and pass pagination to `listMine`.
- [x] 3.14 **GREEN** — Change `src/presentation/http/routes/client.routes.ts` `GET /` to add `validate(paginationQuerySchema, "query")`.

### Driver (mirrors remision: `listByOwner(ownerId, companyId?, search?)`)

- [x] 3.15 **RED** — Create `src/infrastructure/repositories/DriverRepository.test.ts` with `vi.mock` of `../database/models/Driver.model.js`, asserting skip/limit + `countDocuments(filter)` against the `(ownerId, companyId?, search?)` filter. Verify: fails (RED).
- [x] 3.16 **RED** — Create `src/application/use-cases/driver/DriverUseCases.test.ts` with a fake `IDriverRepository`, asserting `listMine` wires `{ items, total }` → `PaginationResponseDTO<Driver>`. Verify: fails (RED).
- [x] 3.17 **GREEN** — Change `src/domain/repositories/IDriverRepository.ts` `listByOwner(ownerId, companyId?, search?, pagination)` → `Promise<{ items: Driver[]; total: number }>`.
- [x] 3.18 **GREEN** — Change `src/infrastructure/repositories/DriverRepository.ts` `listByOwner` to apply `.skip()/.limit()` + `countDocuments(filter)` and return `{ items, total }`.
- [x] 3.19 **GREEN** — Change `src/application/use-cases/driver/DriverUseCases.ts` `listMine` to accept `pagination` and return `buildPaginationResponse(...)`.
- [x] 3.20 **GREEN** — Change `src/presentation/http/controllers/driver.controller.ts` `list` to read coerced `limit`/`page` and pass pagination to `listMine`.
- [x] 3.21 **GREEN** — Change `src/presentation/http/routes/driver.routes.ts` `GET /` to add `validate(paginationQuerySchema, "query")`.

## Phase 4: Verification

- [x] 4.1 Run `bun test` — all new and existing unit tests pass (DTO schema, `totalPages` math, 4 repository skip/limit + count, 4 use-case wiring).
- [x] 4.2 Run `bun run build` — no TypeScript errors across the 4 modified interfaces and every consumer (repositories, use cases, controllers, routes).
- [x] 4.3 Run `biome check .` — lint clean on the modified/new files (no unused imports from the signature changes).
- [x] 4.4 Trace each scenario in `openspec/changes/add-pagination/specs/api-pagination/spec.md` (read-only) to a passing test: query validation (4 rejection scenarios + defaults + `.max(100)`), repository page slice / independent `total` / empty result / page-beyond-last, `totalPages` math (exact, remainder, zero, single page), and filter-composition (`search`/`companyId` preserved via `.passthrough()` and same-filter `countDocuments`).
