# Proposal: Add Pagination to List Endpoints

## Intent

The list endpoints for the core domains (`remision`, `company`, `client`, `driver`) return every matching record in a single response. `listMine` use cases and `listByOwner` repositories currently fetch the full result set with no `skip`/`limit`, so response size and query cost degrade linearly with dataset growth. This change introduces offset-based pagination (limit/page) across those list endpoints, validated at the boundary with Zod, returning a `PaginationResponseDTO<T>` that exposes `items`, `total`, `limit`, `page`, and `totalPages`.

## Scope

### In Scope
- Offset-based pagination (`limit`/`page`) matching the existing `PaginationDTO { limit; page }` shape already present in `src/application/dtos/pagination.dto.ts`.
- A Zod schema for pagination query parameters with coercion from query-string values, a `limit` default and a maximum bound, and a `page` default.
- Paginated response `PaginationResponseDTO<T>` (`items`, `total`, `limit`, `page`, `totalPages`) returned by the four domain list endpoints.
- Repository-level `skip`/`limit` and total-count (`countDocuments`) so pagination composes with the existing `search` and `companyId` filters.
- Use-case `listMine` methods returning `PaginationResponseDTO<T>` with correct `totalPages` computation.
- Route-level query validation via the existing `validate(schema, "query")` middleware on the four list routes.
- Test-first unit tests (strict_tdd is enabled): pagination DTO validation, `totalPages` computation, and repository pagination behavior.
- A new capability spec `api-pagination` at `openspec/changes/add-pagination/specs/api-pagination/spec.md`.

### Out of Scope
- The admin-only user list endpoint (`GET /users` → `UserUseCases.list()` / `UserRepository.list(filter)`), which also returns all records; deferred to a separate change.
- Cursor/keyset pagination, `search-after`, or page-token strategies.
- New sorting or filtering capabilities beyond the existing `search` and `companyId` filters.
- Changing text-search (`$text` / textScore) semantics; pagination must compose with it unchanged.
- Pagination metadata on non-list endpoints (create, getById, update, delete).
- Any frontend/client changes — this repository is backend-only.
- Mongo Atlas Search or `$facet`/`$lookup`-based counting optimizations.

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### New Capabilities
- `api-pagination`: Offset-based pagination for list endpoints — Zod query-param validation with bounds/defaults, paginated response shape (`items` + `total` + `totalPages`), and repository-level skip/limit + count.

### Modified Capabilities
- None

## Approach

Extend the in-progress `src/application/dtos/pagination.dto.ts` (currently plain types, no Zod) with a query-param schema using `z.coerce.number()` (Express query values arrive as strings), integer and positive bounds, a `limit` default (recommended `20`) capped at a maximum (recommended `100`), and a `page` default of `1`. Keep `PaginationResponseDTO<T>` as a plain output type; it is serialization shape, not input validation.

Change the repository interface method `listByOwner(...)` to accept pagination (`limit`/`page`) and return `{ items: T[]; total: number }`, using Mongoose `.skip()`/`.limit()` plus `countDocuments(filter)` against the same filter built for `search`/`companyId`. The use case `listMine(...)` builds the full `PaginationResponseDTO<T>` and derives `totalPages = Math.ceil(total / limit)`, keeping the presentation-shape concern (`totalPages`) out of the repository.

Wire the four list routes (`remision`, `company`, `client`, `driver`) with `validate(paginationQuerySchema, "query")`, and have each controller pass the validated `limit`/`page` through to `listMine` and return `data` as the paginated object. Implementation is test-first: write failing tests for the DTO schema, `totalPages` math, and repository skip/limit + count, then implement.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/application/dtos/pagination.dto.ts` | Modified | Add `paginationQuerySchema` (Zod, coerced, bounded, defaulted) alongside the existing `PaginationDTO`/`PaginationResponseDTO<T>` types |
| `src/domain/repositories/IRemisionRepository.ts` | Modified | Change `listByOwner` signature to accept `limit`/`page` and return `{ items, total }` |
| `src/domain/repositories/ICompanyRepository.ts` | Modified | Change `listByOwner` signature to accept `limit`/`page` and return `{ items, total }` |
| `src/domain/repositories/IClientRepository.ts` | Modified | Change `listByOwner` signature to accept `limit`/`page` and return `{ items, total }` |
| `src/domain/repositories/IDriverRepository.ts` | Modified | Change `listByOwner` signature to accept `limit`/`page` and return `{ items, total }` |
| `src/infrastructure/repositories/RemisionRepository.ts` | Modified | Add `.skip()`/`.limit()` + `countDocuments(filter)` to `listByOwner` |
| `src/infrastructure/repositories/CompanyRepository.ts` | Modified | Add `.skip()`/`.limit()` + `countDocuments(filter)` to `listByOwner` |
| `src/infrastructure/repositories/ClientRepository.ts` | Modified | Add `.skip()`/`.limit()` + `countDocuments(filter)` to `listByOwner` |
| `src/infrastructure/repositories/DriverRepository.ts` | Modified | Add `.skip()`/`.limit()` + `countDocuments(filter)` to `listByOwner` |
| `src/application/use-cases/remision/RemisionUseCases.ts` | Modified | `listMine` accepts pagination and returns `PaginationResponseDTO<Remision>` with `totalPages` |
| `src/application/use-cases/company/CompanyUseCases.ts` | Modified | `listMine` accepts pagination and returns `PaginationResponseDTO<Company>` with `totalPages` |
| `src/application/use-cases/client/ClientUseCases.ts` | Modified | `listMine` accepts pagination and returns `PaginationResponseDTO<Client>` with `totalPages` |
| `src/application/use-cases/driver/DriverUseCases.ts` | Modified | `listMine` accepts pagination and returns `PaginationResponseDTO<Driver>` with `totalPages` |
| `src/presentation/http/controllers/remision.controller.ts` | Modified | `list` reads validated pagination, passes to `listMine`, returns paginated `data` |
| `src/presentation/http/controllers/company.controller.ts` | Modified | `list` reads validated pagination, passes to `listMine`, returns paginated `data` |
| `src/presentation/http/controllers/client.controller.ts` | Modified | `list` reads validated pagination, passes to `listMine`, returns paginated `data` |
| `src/presentation/http/controllers/driver.controller.ts` | Modified | `list` reads validated pagination, passes to `listMine`, returns paginated `data` |
| `src/presentation/http/routes/remision.routes.ts` | Modified | Add `validate(paginationQuerySchema, "query")` to `GET /` |
| `src/presentation/http/routes/company.routes.ts` | Modified | Add `validate(paginationQuerySchema, "query")` to `GET /` |
| `src/presentation/http/routes/client.routes.ts` | Modified | Add `validate(paginationQuerySchema, "query")` to `GET /` |
| `src/presentation/http/routes/driver.routes.ts` | Modified | Add `validate(paginationQuerySchema, "query")` to `GET /` |
| `src/application/dtos/pagination.dto.test.ts` | New | Unit tests for pagination query schema (coercion, bounds, defaults) |
| `src/infrastructure/repositories/*.test.ts` (co-located) | New | Unit tests for repository skip/limit + count behavior |
| `src/application/use-cases/*/**.test.ts` (co-located) | New | Unit tests for `totalPages` computation |
| `openspec/changes/add-pagination/specs/api-pagination/spec.md` | New | Capability spec for pagination |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Repository interface signature change ripples across 4 domains, interfaces, use cases, controllers, and routes; a missed consumer breaks the build. | Med | Single mechanical pattern applied uniformly; `bun run build` type check + strict_tdd unit tests catch missed call sites. |
| `$text` search sort (textScore) combined with `.skip()`/`.limit()` and `countDocuments` may behave unexpectedly on text-filtered queries. | Low | Keep the same filter object for both `find` and `countDocuments`; add a repository test for the search+pagination path; note Mongo behavior if textScore ordering is unstable across pages. |
| Query params arrive as strings in Express; naive `z.number()` would reject every request. | Med | Use `z.coerce.number()` (with `.int().positive()`) and validate in the query source before controllers read it. |
| `skip`/`limit` pagination degrades on very deep pages (offset drift) vs cursor pagination. | Low | Accepted tradeoff for scope; document cursor pagination as future work. |
| Existing API consumers assume `data` is a bare array; response shape changes to `{ items, total, ... }`. | Med | This is a breaking contract change for the list endpoints; flag for consumer coordination and note in rollback plan. |

## Rollback Plan

1. Revert the four repository interface and implementation changes to restore `listByOwner(...): Promise<T[]>`.
2. Revert use-case `listMine` changes to restore `Promise<T[]>` passthrough.
3. Revert controller and route changes to restore `data` as a bare array and remove `validate(paginationQuerySchema, "query")`.
4. Revert `src/application/dtos/pagination.dto.ts` additions (or restore the plain-type-only version), keeping the original `PaginationDTO`/`PaginationResponseDTO<T>` interfaces.
5. Delete any co-located pagination test files added in this change.
6. Verify with `git status`, `bun run build`, and `bun test` to confirm no TypeScript errors and no dangling imports.

## Dependencies

- Mongoose 8 (already in use) supports `.skip()`, `.limit()`, and `countDocuments`.
- Zod (already in use) supports `z.coerce.number()` and `.default()`.
- Existing `validate(schema, source)` middleware already accepts `"query"` as a source.
- No new npm dependencies required.

## Success Criteria

- [ ] `GET /remisiones`, `GET /companies`, `GET /clients`, and `GET /drivers` return `data` shaped as `{ items, total, limit, page, totalPages }`.
- [ ] `limit` defaults to `20`, is capped at a maximum (`100` recommended), and `page` defaults to `1`; invalid values are rejected with HTTP 422.
- [ ] Pagination composes with existing `search` and `companyId` filters without changing their behavior.
- [ ] `totalPages` equals `Math.ceil(total / limit)` and `total` matches `countDocuments` for the same filter.
- [ ] `bun test` passes with new unit tests for the pagination schema, `totalPages` computation, and repository skip/limit + count.
- [ ] `bun run build` succeeds with no TypeScript errors across the modified interfaces and consumers.
