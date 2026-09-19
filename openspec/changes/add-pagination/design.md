# Design: Add Pagination to List Endpoints

## Technical Approach

Introduce offset-based pagination (`limit`/`page`) across the four list endpoints (`remision`, `company`, `client`, `driver`) by threading a validated pagination query through the existing Clean Architecture stack, layer by layer, without changing any of the existing `search`/`companyId` filter semantics.

Concretely, this change is a mechanical, uniform pattern applied to four parallel domains:

1. **Boundary validation (presentation)** — `paginationQuerySchema` (Zod, co-located in `src/application/dtos/pagination.dto.ts`) coerces query-string values to numbers with `z.coerce.number().int().positive()`, applies `.default(20)`/`.max(100)` to `limit` and `.default(1)` to `page`, and is mounted via the existing `validate(schema, "query")` middleware on each `GET /` list route. The schema uses `.passthrough()` so the middleware's wholesale `req.query` replacement does not strip the pre-existing `search`/`companyId` keys.
2. **Repository (domain + infrastructure)** — `listByOwner` gains a trailing pagination parameter and returns `{ items, total }`. The implementation derives `skip = (page - 1) * limit`, applies `.skip(skip).limit(limit)` to the same Mongoose query already built for `search`/`companyId`, and calls `countDocuments(filter)` with the same filter object to compute `total` independently of the page slice.
3. **Use case (application)** — `listMine` accepts pagination, calls the repository, and builds the full `PaginationResponseDTO<T>` via a pure `buildPaginationResponse` helper, deriving `totalPages = Math.ceil(total / limit)`. `totalPages` (a presentation-shape concern) stays out of the repository.
4. **Controller (presentation)** — each `list` handler reads the already-coerced `req.query.limit`/`req.query.page` and passes them to `listMine`, returning `data` as the paginated object inside the existing `{ success, data, message }` envelope.

The response-shape change (`data` from a bare array to `{ items, total, limit, page, totalPages }`) is a breaking contract change for consumers, called out explicitly in the spec (`api-pagination`).

Implementation is test-first (`strict_tdd: true` is set in `openspec/config.yaml`): write RED tests for the Zod schema, `totalPages` math, repository skip/limit + count, and use-case wiring before implementing.

## Architecture Decisions

### Decision: Repository returns `{ items, total }`, not the full `PaginationResponseDTO<T>`

**Choice**: `listByOwner` returns `Promise<{ items: T[]; total: number }>`; the use case assembles the full `PaginationResponseDTO<T>` (adding `limit`, `page`, `totalPages`).

**Alternatives considered**:
- Repository returns the full `PaginationResponseDTO<T>` (computing `totalPages` there).
- Repository returns `{ items, total }` and use case forwards it untouched (no `totalPages` anywhere).

**Rationale**: The repository is a persistence abstraction; `totalPages` is a presentation-shape concern derived from `total`/`limit` and has no persistence meaning. Keeping `{ items, total }` at the boundary (a) preserves the repository's single responsibility, (b) centralizes the `totalPages` derivation in one testable pure function (`buildPaginationResponse`) rather than four repository copies, and (c) matches the spec requirement `totalPages = Math.ceil(total / limit)` at the use-case layer. This is a persistence-concern vs presentation-concern split, not an arbitrary cut.

### Decision: Reject (422) when `limit > 100`, do not clamp

**Choice**: `limit` is bounded with `.max(100)`; a value above the maximum fails validation and is rejected.

**Alternatives considered**:
- Silently clamp `limit` to `100` via `.transform(v => Math.min(v, 100))` or `.refine`.
- No maximum at all (unbounded page size).

**Rationale**: The spec (`api-pagination`) is explicit — "the value is NOT silently clamped to the maximum" and the request is rejected. Clamping hides an out-of-contract request from the client and would make the returned `limit` field lie about what was actually served; rejection gives deterministic, client-visible feedback. An unbounded limit would reintroduce the exact unbounded-response problem this change exists to fix.

### Decision: Pagination Zod schema co-located in `pagination.dto.ts` (with `.passthrough()`)

**Choice**: `paginationQuerySchema` lives in `src/application/dtos/pagination.dto.ts` next to the existing `PaginationDTO`/`PaginationResponseDTO<T>` types, and is declared `.passthrough()`.

**Alternatives considered**:
- A separate `src/presentation/http/schemas/pagination.schema.ts` (or per-route inline schemas).
- Default Zod `strip` mode (implicit) or explicit `.strict()`.

**Rationale**: The DTO file is the established home for Zod schemas (see `remision.dto.ts`, `company.dto.ts`, etc.), so co-locating keeps the convention. The `.passthrough()` is **required for correctness**, not style: the `validate` middleware mutates `req.query` by assignment (`(req as any).query = result.data`). Zod's default `strip` mode would discard the un-declared `search` and `companyId` keys from `req.query` after validation, silently breaking the existing filters; `.strict()` would reject them outright with a validation error. `.passthrough()` preserves the raw `search`/`companyId` values (still read as `typeof req.query.search === "string"` in the controllers) while adding the coerced `limit`/`page`.

### Decision: Pass pagination as a single trailing `pagination` object (inline `{ limit; page }` shape in the domain interface)

**Choice**: `listByOwner(ownerId, companyId?, search?, pagination: { limit: number; page: number })`.

**Alternatives considered**:
- Two trailing positional params: `listByOwner(ownerId, companyId?, search?, limit, page)`.
- A shared domain type file (e.g. `src/domain/repositories/pagination.ts`) exporting `PaginationParams`/`PaginatedResult<T>`, imported by all four interfaces.
- Importing the application-layer `PaginationDTO` directly into the domain interfaces.

**Rationale**: The positional form is error-prone here because the domains are **asymmetric** — `CompanyRepository.listByOwner(ownerId, search?)` has no `companyId`, while the other three do. A 5-arg positional signature with two trailing optional params invites transposed `limit`/`page`/`search` arguments across four call sites with different arity. A single trailing object param is uniform across all four domains. The inline `{ limit; page }` shape (rather than a dedicated domain type or importing `PaginationDTO`) respects the Clean Architecture dependency rule — `domain/repositories/*` must not import from `application/dtos/*` — and TypeScript's structural typing lets the use case pass its `PaginationDTO` (identical shape) without any cross-layer import or cast. (If the team later wants a named shared-kernel type, `PaginationParams` in `src/domain/` is a trivial, non-breaking follow-up; it is not required now.)

### Decision: Flat response envelope `{ items, total, limit, page, totalPages }` inside the existing `data` field

**Choice**: `PaginationResponseDTO<T>` is a flat object; controllers return it as `data` within the existing `{ success, data, message }` envelope.

**Alternatives considered**:
- Nested shape, e.g. `data: { items, meta: { total, limit, page, totalPages } }`.
- Flattening pagination metadata onto the top-level envelope (next to `success`/`message`).

**Rationale**: The spec (`api-pagination`) fixes the shape as `items`, `total`, `limit`, `page`, `totalPages` at the `data` key, and the existing `PaginationResponseDTO<T>` interface in `pagination.dto.ts` already declares exactly this flat shape. The top-level `{ success, data, message }` envelope is a pre-existing, cross-cutting response convention applied to every endpoint; pagination metadata belongs under `data` (the resource payload), not scattered across the envelope. Nested `meta` would add a second nesting level for no benefit and diverge from the already-scaffolded type.

## Data Flow

```
GET /remisiones?limit=10&page=2&search=foo
        │
        ▼
[route] remision.routes.ts
        validate(paginationQuerySchema, "query")   ← coerces "10"→10, "2"→2,
        │                                           defaults applied when absent;
        │                                           .passthrough() keeps search/companyId
        ▼
[controller] remision.controller.ts  (list)
        reads req.query.limit (number), req.query.page (number),
        req.query.search / companyId (raw string, existing guards)
        calls listMine(ownerId, companyId, search, { limit, page })
        │
        ▼
[use case] RemisionUseCases.listMine
        const { items, total } = await repo.listByOwner(ownerId, companyId, search, { limit, page })
        return buildPaginationResponse(items, total, limit, page)
                └─ totalPages = Math.ceil(total / limit)
        │
        ▼
[repository] RemisionRepository.listByOwner
        filter = { ownerId, ...companyId?, ...$text? }     ← unchanged filter build
        skip = (page - 1) * limit
        items = await Model.find(filter).sort(...).skip(skip).limit(limit)   → map(toDomain)
        total = await Model.countDocuments(filter)          ← same filter, independent of page
        return { items, total }
        │
        ▼
[response] { success: true, data: { items, total, limit, page, totalPages }, message }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/application/dtos/pagination.dto.ts` | Modify | Add `paginationQuerySchema` (coerced/bounded/defaulted, `.passthrough()`) and pure `buildPaginationResponse<T>(items, total, limit, page)` helper alongside existing `PaginationDTO`/`PaginationResponseDTO<T>` |
| `src/domain/repositories/IRemisionRepository.ts` | Modify | `listByOwner` gains trailing `pagination: { limit; page }`, returns `Promise<{ items: Remision[]; total: number }>` |
| `src/domain/repositories/ICompanyRepository.ts` | Modify | `listByOwner` gains trailing `pagination` (no `companyId` param), returns `Promise<{ items: Company[]; total: number }>` |
| `src/domain/repositories/IClientRepository.ts` | Modify | `listByOwner` gains trailing `pagination`, returns `Promise<{ items: Client[]; total: number }>` |
| `src/domain/repositories/IDriverRepository.ts` | Modify | `listByOwner` gains trailing `pagination`, returns `Promise<{ items: Driver[]; total: number }>` |
| `src/infrastructure/repositories/RemisionRepository.ts` | Modify | Derive `skip = (page-1)*limit`; `.skip(skip).limit(limit)` on the find query; `countDocuments(filter)` for `total` |
| `src/infrastructure/repositories/CompanyRepository.ts` | Modify | Same skip/limit + `countDocuments` applied to its `(ownerId, search?)` filter |
| `src/infrastructure/repositories/ClientRepository.ts` | Modify | Same skip/limit + `countDocuments` applied to its `(ownerId, companyId?, search?)` filter |
| `src/infrastructure/repositories/DriverRepository.ts` | Modify | Same skip/limit + `countDocuments` applied to its `(ownerId, companyId?, search?)` filter |
| `src/application/use-cases/remision/RemisionUseCases.ts` | Modify | `listMine` accepts `pagination`, returns `PaginationResponseDTO<Remision>` via `buildPaginationResponse` |
| `src/application/use-cases/company/CompanyUseCases.ts` | Modify | `listMine` accepts `pagination`, returns `PaginationResponseDTO<Company>` via `buildPaginationResponse` |
| `src/application/use-cases/client/ClientUseCases.ts` | Modify | `listMine` accepts `pagination`, returns `PaginationResponseDTO<Client>` via `buildPaginationResponse` |
| `src/application/use-cases/driver/DriverUseCases.ts` | Modify | `listMine` accepts `pagination`, returns `PaginationResponseDTO<Driver>` via `buildPaginationResponse` |
| `src/presentation/http/controllers/remision.controller.ts` | Modify | `list` reads coerced `req.query.limit`/`.page`, passes pagination to `listMine`, returns paginated `data` |
| `src/presentation/http/controllers/company.controller.ts` | Modify | `list` reads coerced `req.query.limit`/`.page`, passes pagination to `listMine`, returns paginated `data` |
| `src/presentation/http/controllers/client.controller.ts` | Modify | `list` reads coerced `req.query.limit`/`.page`, passes pagination to `listMine`, returns paginated `data` |
| `src/presentation/http/controllers/driver.controller.ts` | Modify | `list` reads coerced `req.query.limit`/`.page`, passes pagination to `listMine`, returns paginated `data` |
| `src/presentation/http/routes/remision.routes.ts` | Modify | Add `validate(paginationQuerySchema, "query")` to `router.get("/")` |
| `src/presentation/http/routes/company.routes.ts` | Modify | Add `validate(paginationQuerySchema, "query")` to `router.get("/")` |
| `src/presentation/http/routes/client.routes.ts` | Modify | Add `validate(paginationQuerySchema, "query")` to `router.get("/")` |
| `src/presentation/http/routes/driver.routes.ts` | Modify | Add `validate(paginationQuerySchema, "query")` to `router.get("/")` |
| `src/application/dtos/pagination.dto.test.ts` | Create | Unit tests: schema coercion/defaults/bounds/rejection + `buildPaginationResponse` `totalPages` scenarios |
| `src/infrastructure/repositories/RemisionRepository.test.ts` | Create | Unit tests (mocked model): skip/limit args, `countDocuments` uses same filter, `{ items, total }` assembly |
| `src/infrastructure/repositories/CompanyRepository.test.ts` | Create | Same mocked-model coverage for `(ownerId, search?)` |
| `src/infrastructure/repositories/ClientRepository.test.ts` | Create | Same mocked-model coverage for `(ownerId, companyId?, search?)` |
| `src/infrastructure/repositories/DriverRepository.test.ts` | Create | Same mocked-model coverage for `(ownerId, companyId?, search?)` |
| `src/application/use-cases/remision/RemisionUseCases.test.ts` | Create | Unit tests (fake repo): `listMine` wires `{ items, total }` → `PaginationResponseDTO` |
| `src/application/use-cases/company/CompanyUseCases.test.ts` | Create | Same wiring test |
| `src/application/use-cases/client/ClientUseCases.test.ts` | Create | Same wiring test |
| `src/application/use-cases/driver/DriverUseCases.test.ts` | Create | Same wiring test |

## Interfaces / Contracts

Project style: tabs, double quotes, `.js` import extensions, ES modules.

### `src/application/dtos/pagination.dto.ts` (extended)

```ts
import { z } from "zod";

export interface PaginationDTO {
	limit: number;
	page: number;
}

export interface PaginationResponseDTO<T> {
	items: T[];
	total: number;
	limit: number;
	page: number;
	totalPages: number;
}

// Express query values arrive as strings; coerce before validating.
// .passthrough() is REQUIRED: validate() replaces req.query wholesale, and
// default strip mode would drop the pre-existing `search`/`companyId` keys.
export const paginationQuerySchema = z
	.object({
		limit: z.coerce.number().int().positive().max(100).default(20),
		page: z.coerce.number().int().positive().default(1),
	})
	.passthrough();

export function buildPaginationResponse<T>(
	items: T[],
	total: number,
	limit: number,
	page: number,
): PaginationResponseDTO<T> {
	return {
		items,
		total,
		limit,
		page,
		totalPages: Math.ceil(total / limit),
	};
}
```

### Repository interface (representative — `IRemisionRepository.ts`)

```ts
import { Remision } from "../entities/Remision.js";

export interface IRemisionRepository {
	// ...unchanged create/findById/update/delete/getNextConsecutive...

	listByOwner(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination: { limit: number; page: number },
	): Promise<{ items: Remision[]; total: number }>;
}
```

`ICompanyRepository.listByOwner` differs only in arity — `(ownerId: string, search?: string, pagination: { limit: number; page: number })` — returning `{ items: Company[]; total: number }`. `IClientRepository`/`IDriverRepository` mirror the Remision shape with `Client`/`Driver`.

### Repository implementation (representative — `RemisionRepository.listByOwner`)

```ts
	async listByOwner(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination: { limit: number; page: number } = { limit: 20, page: 1 },
	): Promise<{ items: Remision[]; total: number }> {
		const filter: Record<string, unknown> = { ownerId };
		if (companyId) filter.companyId = companyId;
		if (search && search.trim().length > 0) {
			filter.$text = { $search: search.trim() };
		}
		const query = RemisionModel.find(filter);
		if (search && search.trim().length > 0) {
			query.select({ score: { $meta: "textScore" } });
			query.sort({ score: { $meta: "textScore" } });
		} else {
			query.sort({ createdAt: -1 });
		}
		const skip = (pagination.page - 1) * pagination.limit;
		const [docs, total] = await Promise.all([
			query.skip(skip).limit(pagination.limit),
			RemisionModel.countDocuments(filter),
		]);
		return { items: docs.map(toDomain), total };
	}
```

### Use case `listMine` (representative — `RemisionUseCases`)

```ts
	async listMine(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination: PaginationDTO = { limit: 20, page: 1 },
	): Promise<PaginationResponseDTO<Remision>> {
		const { items, total } = await this.remisionRepo.listByOwner(
			ownerId,
			companyId,
			search,
			pagination,
		);
		return buildPaginationResponse(items, total, pagination.limit, pagination.page);
	}
```

Note: `pagination: PaginationDTO` is passed to `listByOwner` through structural typing (`PaginationDTO` is `{ limit; page }`), so the domain interface never imports the application type.

## Testing Strategy

`openspec/config.yaml` sets `integration: false` and `e2e: false`, so this change is **unit-only**; no DB-backed integration or E2E tests are added. `strict_tdd: true` mandates RED → GREEN → REFACTOR ordering.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — DTO | `paginationQuerySchema` coercion (`"10"`→`10`), defaults (`limit=20`, `page=1`), bounds (reject `0`, negative, non-integer `10.5`, non-numeric `abc`, `limit>100`), `.passthrough()` preserves `search`/`companyId` | `safeParse` assertions in `pagination.dto.test.ts` (matches `remision.dto.test.ts` conventions) |
| Unit — pure math | `buildPaginationResponse` `totalPages`: exact division (40/20→2), remainder (45/20→3), zero total (0/20→0), `limit > total` (5/20→1) | Direct function calls in `pagination.dto.test.ts` |
| Unit — repository | `skip = (page-1)*limit` and `.limit(limit)` args; `countDocuments(filter)` receives the **same** filter (incl. `$text`); `{ items, total }` assembly; empty result → `{ items: [], total: 0 }`; page beyond last → empty items but correct `total` | `bun:test` + `vi.mock` of the Mongoose model, asserting the query chain and count args — no real DB, honoring the "no mongoose/network/filesystem" convention |
| Unit — use case | `listMine` wires a fake repo's `{ items, total }` into `PaginationResponseDTO` with correct `limit`/`page`/`totalPages` | Inject a fake `IRemisionRepository`/etc. (no mongoose), assert the returned DTO shape |

Integration (actual `.skip()`/`.limit()`/`countDocuments` against a live Mongo, and the `$text` textScore ordering-across-pages behavior) is explicitly deferred, consistent with `integration: false`.

## Threat Matrix

`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.` Pagination validation is a pure Zod boundary concern and a read-path query slice; there is no new attack surface introduced by this change.

## Migration / Rollout

**Breaking response-shape change.** The four list endpoints currently return `data` as a bare array; after this change they return `{ items, total, limit, page, totalPages }`. Consumers that index `data` as an array must be updated in lockstep. There is **no data migration** — no schema change, no backfill, no feature flag; the rollout is purely a coordinated API-contract change:

1. Land backend change (this change) with the new paginated shape.
2. Coordinate frontend/consumer updates to read `data.items` and the metadata fields.
3. No DB indexes are added or removed; existing text indexes and sort behavior are untouched.

Rollback (from the proposal) is a straightforward revert of the interface/implementation/use-case/controller/route/DTO changes, restoring `data` to a bare array; verify with `git status`, `bun run build`, and `bun test`.

## Open Questions

- [x] **Resolved: align to 422.** Spec and proposal updated to reject invalid pagination params with HTTP 422, matching the existing `validate` middleware (`ValidationError`).
- [x] **Resolved: `limit` default is 20.** Confirmed by user; maximum remains 100.
- [x] **Resolved: out-of-range `page` returns empty `items`** with the correct `total`; no clamp/redirect.
