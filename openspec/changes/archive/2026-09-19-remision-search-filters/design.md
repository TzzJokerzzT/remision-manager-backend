# Design: Remision List Search and Filters

## Technical Approach

Add five optional query parameters to `GET /remisiones` — `clientName`, `driverName`, `type`, `from`, `to` — that compose with the existing `companyId`, `search` (notes `$text`), and offset pagination. Names live in the `Client`/`Driver` collections, not on the remision document, so `clientName`/`driverName` are resolved in two steps: run a case-insensitive, escaped-regex substring query against `Client.name`/`Driver.name` to collect matching ids, then add `filter.clientId = { $in: ids }` / `filter.driverId = { $in: ids }` to the remision query. `type` is an exact field filter. `from`/`to` map to an inclusive `createdAt` range (`$gte from`, `$lte to`), with a date-only `to` normalized to end-of-day (`23:59:59.999Z`) in UTC.

Resolution happens in the application layer (`RemisionUseCases.listMine`), which gains a `IDriverRepository` dependency. The repository gains a filters-object parameter and stays a pure persistence filter builder — it never knows about names. This keeps `listByOwner` on `find()`/`countDocuments()` (no `$lookup`/`$facet` aggregation rewrite) so `total` always reflects the fully filtered set.

This maps directly to the `remision-search` capability spec (`specs/remision-search/spec.md`) and implements the proposal's recommended approach (b): two-step id resolution.

## Architecture Decisions

### Decision 1: Two-step id resolution (no `$lookup`, no denormalization)

**Choice**: Resolve `clientName`/`driverName` into id arrays via the `Client`/`Driver` repositories, then filter remisions with `$in` over `clientId`/`driverId`.

**Alternatives considered**:
- **(a) `$lookup` aggregation** — join `Client`/`Driver` at query time. Forces `listByOwner` from `find()` to `aggregate()`, and `countDocuments()` to `$facet`/`$count`. `Remision.clientId`/`driverId` are currently **unindexed**, so the join degrades further. More invasive for no correctness gain here.
- **(c) Denormalize `clientName`/`driverName` onto the remision document** — fastest query, but adds write-time maintenance (populate on create/update, sync on client/driver rename) plus a new text index. Deferred (already documented as out of scope in the proposal).

**Rationale**: Two-step is constant (2–3 queries regardless of dataset), preserves the current `find`/`countDocuments` path (so `total` stays accurate against the same filter), reuses the existing enrichment pattern (`listMine` already calls `clientRepo.findByIds`), and matches the proposal/spec. The id arrays produced by `$in` are bounded by how many `Client`/`Driver` docs match a name — small for typical datasets — and the whole thing stays backend-only.

### Decision 2: Resolution lives in the use case, repository stays a dumb filter

**Choice**: `RemisionUseCases.listMine` resolves names → ids via `clientRepo.findIdsByName`/`driverRepo.findIdsByName`, then passes a `RemisionListFilters` object to `remisionRepo.listByOwner`.

**Alternatives considered**:
- Resolve inside `RemisionRepository` (repository calls `Client`/`Driver` models directly).
- Add a dedicated "search service" layer.

**Rationale**: The codebase's existing convention puts orchestration in use cases and keeps repositories as thin persistence adapters (`listMine` already enriches names; `create`/`update`/`getById` already coordinate multiple repos). The repository accepts `clientIds`/`driverIds` (already-resolved) so its only concern is building one Mongo filter — testable in isolation without mocking cross-collection lookups. A new service layer would be over-engineering for a single endpoint.

### Decision 3: Escaped case-insensitive regex for name matching (not `$text`)

**Choice**: `new RegExp(escapeRegex(name), "i")` → `{ name: { $regex: escapeRegex(name), $options: "i" } }`.

**Alternatives considered**:
- `$text` search — word/stem-based, NOT substring; fails "acme" → "ACME Supplies" style contains-match required by the spec, and behaves unpredictably across casing.
- `$where`/raw string regex — regex-injection/ReDoS risk; no input escaping.

**Rationale**: A substring regex is the only mechanism that delivers the spec's "case-insensitive substring contains" semantics. **The input MUST be escaped** (`escapeRegex`) so regex metacharacters in user input are treated literally, mitigating regex-injection and catastrophic-backtracking ReDoS. The existing `notes` `$text` search path is retained unchanged and composes with the new filters. Client/Driver `name` fields already carry a `text` index but that index does NOT accelerate a substring `$regex`; these collections are small, and denormalization remains the documented scale fallback (Decision 1).

### Decision 4: Dedicated `remisionListQuerySchema` (no `.passthrough()`)

**Choice**: A new Zod schema, `remisionListQuerySchema`, validates `clientName`/`driverName`/`type`/`from`/`to` **and** `limit`/`page`/`companyId`/`search` in one object with **no `.passthrough()`**. The `GET /` route swaps `validate(paginationQuerySchema, "query")` for `validate(remisionListQuerySchema, "query")`.

**Alternatives considered**:
- Extend `paginationQuerySchema` — it is defined with `.passthrough()`, so `.extend()` inherits pass-through and unvalidated filter values leak into `req.query` (explicitly forbidden by the spec's "Boundary Validation" requirement).
- Run `validate(paginationQuerySchema, "query")` then a second `validate(remisionListQuerySchema, "query")` — `validate` **replaces** `req.query` wholesale with `result.data`; a second strict parse would drop `limit`/`page`, and two replacements are fragile.

**Rationale**: Default Zod object mode strips unknown keys, so only validated/coerced values reach the controller — satisfying the spec's "MUST NOT allow unvalidated filter values to reach the controller". The schema re-declares `limit`/`page` with identical rules (positive int, `limit` ≤ 100, defaults 20/1) so pagination behavior is preserved. `paginationQuerySchema` remains in place for the other list endpoints (client/driver/company). `companyId` stays an optional trimmed string (preserving today's list behavior; not in scope to tighten it to a MongoId).

### Decision 5: Date semantics — UTC, inclusive, date-only `to` → end-of-day

**Choice**: `from` → `{ $gte }`, `to` → `{ $lte }` (both optional, combinable). All parsing/normalization is done in the DTO layer against UTC: `new Date(v)` parses ISO date-only as UTC midnight; a date-only `to` is bumped to `23:59:59.999Z` via `setUTCHours(23, 59, 59, 999)`.

**Alternatives considered**:
- `z.coerce.date()` — in **Zod 3** (this project pins `zod@^3.23.8`, resolved 3.25.76), `z.coerce.date()` only checks `instanceof Date`, so `from=not-a-date` coerces to an `Invalid Date` and is **accepted** — violating the spec's 422 requirement. Rejected in favor of explicit ISO validation (`regex` + `!Number.isNaN(Date.parse(v))`).
- Server-local timezone — rejected for determinism; UTC is the codebase convention (`createdAt` is a Mongo timestamp).

**Rationale**: Inclusive bounds match the spec exactly (`$gte from`, `$lte to`); end-of-day normalization implements the spec's "date-only `to` MUST be interpreted as end-of-day" so the full day is included. Doing it in the DTO keeps the repository free of date-interpretation logic (it just places `Date` objects into `$gte`/`$lte`).

### Decision 6: Leave `clientId`/`driverId` unindexed (flagged follow-up)

**Choice**: Do NOT add indexes in this change; record as a follow-up.

**Alternatives considered**: Add `{ clientId: 1 }` / `{ driverId: 1 }` (or compound with `ownerId`) now.

**Rationale**: `Remision.clientId`/`driverId` are currently unindexed, so `$in` filtering at scale would benefit from indexes. This is a performance optimization independent of the filtering feature's correctness, touches a production schema, and the proposal scopes it as "Optional". Deferred to keep this change focused and reviewable; the `$in` is still constrained by `ownerId` (indexed) which limits the scan. Flagged in the Affected Areas table and as a follow-up in Open Questions.

## Data Flow

```
GET /remisiones?clientName=acme&driverName=carlos&type=priced&from=2026-01-01&to=2026-01-31&limit=10&page=1
   │
   ▼
authenticate (middleware)
   │
   ▼
validate(remisionListQuerySchema, "query")   ← parse/coerce/trim; 422 on invalid type/dates; replaces req.query
   │
   ▼
RemisionController.list  →  remisionUseCases.listMine(ownerId, req.query)
   │
   ├─ clientName present ──▶ clientRepo.findIdsByName(name) ──▶ clientIds: string[]
   ├─ driverName present ──▶ driverRepo.findIdsByName(name) ──▶ driverIds: string[]
   │
   ▼
remisionRepo.listByOwner(ownerId, { companyId, search, clientIds, driverIds, type, from, to }, { limit, page })
   │
   ├─ RemisionModel.find(filter)      → sort(textScore | createdAt desc) → skip/limit
   └─ RemisionModel.countDocuments(filter)     ← SAME filter ⇒ accurate `total`
   │
   ▼
enrich clientName (clientRepo.findByIds) → buildPaginationResponse → JSON { success, data, message }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/shared/utils/escape-regex.ts` | Create | `escapeRegex(value)` — escapes regex metacharacters so name input is treated literally. |
| `src/shared/utils/escape-regex.test.ts` | Create | Unit tests: metacharacters (`.*+?^${}()\|[]\\`) are escaped; plain strings unchanged. |
| `src/application/dtos/remision-list-query.dto.ts` | Create | `remisionListQuerySchema` (limit/page/companyId/search + `clientName`/`driverName`/`type`/`from`/`to`, no `.passthrough()`) + `RemisionListQueryDTO` type. |
| `src/application/dtos/remision-list-query.dto.test.ts` | Create | Unit tests for validation/coercion/trim/date end-of-day and 422 rejection. |
| `src/domain/repositories/IRemisionRepository.ts` | Modify | Export `RemisionListFilters`; change `listByOwner` to `(ownerId, filters, pagination)`. |
| `src/infrastructure/repositories/RemisionRepository.ts` | Modify | Build filter: owner + company + `$text` + `$in` ids + `type` + `$gte/$lte` date; preserve `find`/`countDocuments` sharing. |
| `src/domain/repositories/IClientRepository.ts` | Modify | Add `findIdsByName(name: string): Promise<string[]>`. |
| `src/infrastructure/repositories/ClientRepository.ts` | Modify | Implement `findIdsByName` (escaped case-insensitive regex over `name`, select `_id`). |
| `src/domain/repositories/IDriverRepository.ts` | Modify | Add `findIdsByName(name: string): Promise<string[]>`. |
| `src/infrastructure/repositories/DriverRepository.ts` | Modify | Implement `findIdsByName` (mirror of client). |
| `src/application/use-cases/remision/RemisionUseCases.ts` | Modify | Constructor gains `driverRepo`; `listMine` accepts `RemisionListQueryDTO`, resolves names→ids, passes filters to repo. |
| `src/di/container.ts` | Modify | Inject `driverRepository` into `RemisionUseCases`. |
| `src/presentation/http/controllers/remision.controller.ts` | Modify | `list` reads typed `req.query` and passes it to `listMine(ownerId, query)`. |
| `src/presentation/http/routes/remision.routes.ts` | Modify | `GET /` uses `validate(remisionListQuerySchema, "query")` (replaces `paginationQuerySchema`). |
| `src/infrastructure/repositories/RemisionRepository.test.ts` | Modify | Update calls to the new signature; add tests for `$in` (incl. empty-array), `type`, and date-range construction. |
| `src/infrastructure/repositories/ClientRepository.test.ts` | Modify | Add `findIdsByName` tests (regex escaping, empty result, id-only projection). |
| `src/infrastructure/repositories/DriverRepository.test.ts` | Modify | Add `findIdsByName` tests (mirror). |
| `src/application/use-cases/remision/RemisionUseCases.test.ts` | Modify | Update constructor (add fake `driverRepo`); add name→id resolution and filter-composition tests. |

No files are deleted.

## Interfaces / Contracts

### `RemisionListFilters` (exported from `IRemisionRepository.ts`)

```ts
import { Remision } from "@/domain/entities/Remision.js";

export interface RemisionListFilters {
	companyId?: string;
	search?: string;
	clientIds?: string[];
	driverIds?: string[];
	type?: Remision["type"];
	from?: Date;
	to?: Date;
}
```

### `IRemisionRepository.listByOwner` (new signature)

```ts
export interface IRemisionRepository {
	create(
		data: Omit<Remision, "id" | "createdAt" | "updatedAt">,
	): Promise<Remision>;
	findById(id: string): Promise<Remision | null>;
	update(id: string, data: Partial<Remision>): Promise<Remision | null>;
	delete(id: string): Promise<boolean>;
	listByOwner(
		ownerId: string,
		filters?: RemisionListFilters,
		pagination?: { limit: number; page: number },
	): Promise<{ items: Remision[]; total: number }>;
	getNextConsecutive(companyId: string): Promise<number>;
}
```

### Name-id resolution helpers

```ts
// IClientRepository.ts
export interface IClientRepository {
	// ... existing members ...
	findIdsByName(name: string): Promise<string[]>;
}

// IDriverRepository.ts
export interface IDriverRepository {
	// ... existing members ...
	findIdsByName(name: string): Promise<string[]>;
}
```

### `escapeRegex` helper

```ts
// src/shared/utils/escape-regex.ts
export function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

### Repository `findIdsByName` implementations

```ts
// ClientRepository.ts
async findIdsByName(name: string): Promise<string[]> {
	const trimmed = name.trim();
	if (trimmed.length === 0) return [];
	const docs = await ClientModel.find({
		name: { $regex: escapeRegex(trimmed), $options: "i" },
	}).select("_id");
	return docs.map((doc) => doc.id.toString());
}
```

`DriverRepository.findIdsByName` is identical but queries `DriverModel`. Both return **ids only** (not full entities), distinct from `findByIds` (which returns full `Client[]` for enrichment).

### `remisionListQuerySchema` + DTO type

```ts
// src/application/dtos/remision-list-query.dto.ts
import { z } from "zod";

const optionalTrimmedName = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim().length > 0
			? value.trim()
			: undefined,
	z.string().min(1).max(150).optional(),
);

const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTime =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/;

const fromQuery = z
	.string()
	.trim()
	.refine((value) => isoDateOnly.test(value) || isoDateTime.test(value), {
		message: "from must be an ISO date (YYYY-MM-DD) or ISO datetime",
	})
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "from is not a valid date",
	})
	.transform((value) => new Date(value))
	.optional();

const toQuery = z
	.string()
	.trim()
	.refine((value) => isoDateOnly.test(value) || isoDateTime.test(value), {
		message: "to must be an ISO date (YYYY-MM-DD) or ISO datetime",
	})
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "to is not a valid date",
	})
	.transform((value) => {
		const date = new Date(value);
		// Date-only "to" is end-of-day (inclusive full day) in UTC.
		if (isoDateOnly.test(value)) {
			date.setUTCHours(23, 59, 59, 999);
		}
		return date;
	})
	.optional();

export const remisionListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(20),
	page: z.coerce.number().int().positive().default(1),
	companyId: z.string().trim().optional(),
	search: z.string().trim().optional(),
	clientName: optionalTrimmedName,
	driverName: optionalTrimmedName,
	type: z.enum(["priced", "quantity_only"]).optional(),
	from: fromQuery,
	to: toQuery,
});
// No .passthrough(): unknown query keys are stripped so unvalidated filter
// values never reach the controller (spec: "Boundary Validation").

export type RemisionListQueryDTO = z.infer<typeof remisionListQuerySchema>;
```

### `RemisionUseCases` changes

```ts
import type { IDriverRepository } from "@/domain/repositories/IDriverRepository.js";
import type {
	IRemisionRepository,
	RemisionListFilters,
} from "@/domain/repositories/IRemisionRepository.js";
import type { RemisionListQueryDTO } from "@/application/dtos/remision-list-query.dto.js";

export class RemisionUseCases {
	constructor(
		private readonly remisionRepo: IRemisionRepository,
		private readonly companyRepo: ICompanyRepository,
		private readonly clientRepo: IClientRepository,
		private readonly driverRepo: IDriverRepository,
	) {}

	async listMine(
		ownerId: string,
		query: RemisionListQueryDTO = {},
	): Promise<PaginationResponseDTO<RemisionWithClient>> {
		const {
			companyId,
			search,
			clientName,
			driverName,
			type,
			from,
			to,
			limit,
			page,
		} = query;

		// Resolve names → ids. `undefined` = "filter not supplied";
		// `[]` = "supplied but no matches" (⇒ `$in: []` ⇒ empty result).
		const clientIds =
			clientName !== undefined
				? await this.clientRepo.findIdsByName(clientName)
				: undefined;
		const driverIds =
			driverName !== undefined
				? await this.driverRepo.findIdsByName(driverName)
				: undefined;

		const filters: RemisionListFilters = {
			companyId,
			search,
			clientIds,
			driverIds,
			type,
			from,
			to,
		};
		const { items, total } = await this.remisionRepo.listByOwner(
			ownerId,
			filters,
			{ limit, page },
		);

		// Unchanged enrichment path.
		const clientIdsSet = [...new Set(items.map((i) => i.clientId))];
		const clients = await this.clientRepo.findByIds(clientIdsSet);
		const nameById = new Map(clients.map((c) => [c.id, c.name]));
		const enriched = items.map((item) => ({
			...item,
			clientName: nameById.get(item.clientId) ?? "",
		}));
		return buildPaginationResponse(enriched, total, limit, page);
	}
}
```

### Repository filter construction contract (`RemisionRepository.listByOwner`)

```ts
async listByOwner(
	ownerId: string,
	filters: RemisionListFilters = {},
	pagination: { limit: number; page: number } = { limit: 20, page: 1 },
): Promise<{ items: Remision[]; total: number }> {
	const { companyId, search, clientIds, driverIds, type, from, to } = filters;
	const filter: Record<string, unknown> = { ownerId };
	if (companyId) filter.companyId = companyId;
	if (search && search.trim().length > 0) {
		filter.$text = { $search: search.trim() };
	}
	// CRITICAL: guard on `!== undefined`, NOT `length > 0`. An empty array
	// means "no name match" and MUST produce `$in: []` (matches nothing).
	if (clientIds !== undefined) filter.clientId = { $in: clientIds };
	if (driverIds !== undefined) filter.driverId = { $in: driverIds };
	if (type !== undefined) filter.type = type;
	if (from !== undefined || to !== undefined) {
		filter.createdAt = {};
		if (from !== undefined) filter.createdAt.$gte = from;
		if (to !== undefined) filter.createdAt.$lte = to;
	}
	// ... `find`/`sort`/`skip`/`limit`/`countDocuments` unchanged ...
}
```

### Route + controller wiring

```ts
// remision.routes.ts
router.get("/", validate(remisionListQuerySchema, "query"), controller.list);
```

```ts
// remision.controller.ts — list handler
const query = req.query as RemisionListQueryDTO;
const remisiones = await this.remisionUseCases.listMine(req.user!.id, query);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (DTO) | `remisionListQuerySchema` — coercion of `limit`/`page`; trim of `clientName`/`driverName` (whitespace-only → absent); `type` enum accept/reject; `from`/`to` ISO accept + `not-a-date`/`2026-13-99` reject; date-only `to` → end-of-day; unknown keys stripped (no `.passthrough()` leak) | `bun:test` + `safeParse` assertions (never `expect().toThrow` for negative cases); new `remision-list-query.dto.test.ts`. |
| Unit (helper) | `escapeRegex` — metacharacters escaped, plain strings unchanged | `escape-regex.test.ts`. |
| Unit (use case) | `listMine` resolves `clientName`/`driverName` → `findIdsByName` calls; passes `{ $in }`-ready filters to `listByOwner`; skips resolution when names absent; preserves clientName enrichment; composes with `companyId`/`search` | Fake repositories (no mongoose), mirroring `RemisionUseCases.test.ts` conventions; constructor updated with a fake `driverRepo`. |
| Unit (repositories) | `RemisionRepository.listByOwner` builds `$in`/`type`/date filter for BOTH `find` and `countDocuments`; empty `clientIds`/`driverIds` produces `$in: []` (not omitted); `findIdsByName` escapes regex + projects `_id` + returns `[]` on empty/whitespace | `vi.mock` of the Mongoose model (existing pattern); extend `RemisionRepository.test.ts`, `ClientRepository.test.ts`, `DriverRepository.test.ts`. |
| Integration | Deferred — no integration/e2e layers enabled (`config.yaml`: integration `false`, e2e `false`) | N/A |

Test-first (RED→GREEN→REFACTOR) per `config.yaml` `strict_tdd: true`. Key RED cases that encode the non-obvious behavior: (1) no name match → `items: []`, `total: 0` (empty `$in`), (2) invalid ISO date → 422, (3) date-only `to` → `23:59:59.999Z`, (4) metacharacter input (`a.b`, `a+b`) treated literally.

## Threat Matrix

`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in this change.`

The only user-input-to-engine surface is the name regex, and its mitigation is documented under Architecture Decision 3: all name input passes through `escapeRegex` before `new RegExp(...)` / `$regex`, neutralizing regex-injection and catastrophic-backtracking ReDoS. Date fields are validated against an allowlist regex + `Date.parse` validity check, so no arbitrary value reaches Mongo date operators. No applicable threat-matrix rows exist, so no RED tests are required for that matrix.

## Migration / Rollout

No data migration, no feature flags, no phased rollout required. The change is **additive and backward compatible** at the API boundary: all five query params are optional, and requests that omit them produce exactly today's behavior. The `listByOwner` signature change is internal-only (consumers are `RemisionUseCases` and its tests); no external contract changes. Rollback follows the proposal's plan (revert `listByOwner` signature, `RemisionUseCases` constructor/DI, the name-search helpers, the query schema, and route/controller wiring). The optional `clientId`/`driverId` indexes (Decision 6) are a separate, deferred follow-up and can be applied independently.

## Open Questions

- [ ] **`from > to` handling** — the proposal's success criteria and risk table mention rejecting `from > to` with 422, but the `remision-search` spec does **not** include such a scenario (an inverted range would simply return an empty result). Confirm whether to add a `.refine((d) => !d.from || !d.to || d.from <= d.to)` to the schema, or leave the spec as-is.
- [ ] **`companyId` tightening** — the new schema keeps `companyId` as an optional trimmed string (preserving current passthrough behavior). Should the list endpoint validate it as a MongoId (`/^[a-fA-F0-9]{24}$/`) like the create schema does? Not required by the spec; flagged only.
- [ ] **`clientId`/`driverId` index follow-up** — confirm the follow-up work item to add `{ clientId: 1 }` / `{ driverId: 1 }` (or compound with `ownerId`) on `RemisionModel` for `$in` at scale (Decision 6).
