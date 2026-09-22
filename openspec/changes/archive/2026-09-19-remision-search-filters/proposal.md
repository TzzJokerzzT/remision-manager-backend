# Proposal: Remision List Search and Filters

## Intent

Users can currently list their remisiones (`GET /remisiones`) filtered only by an optional `companyId` and a free-text `search` that matches a MongoDB `$text` index over the `notes` field. There is no way to locate remisiones by **client name**, **driver (conductor)**, **remision type**, or **date range** — the four dimensions that most often drive a lookup. This change adds those filters to the remision list endpoint, composing them with the existing `search`, `companyId`, and pagination behavior so the `total` count always reflects the fully filtered result set.

## Scope

### In Scope
- New query filters on `GET /remisiones`: client name (`clientName`), driver/conductor (`driverName`), remision type (`type` = `priced` | `quantity_only`), and date range (`from`/`to` over `createdAt`).
- Resolution of `clientName`/`driverName` into remision `clientId`/`driverId` matches, since names live in the `Client`/`Driver` collections.
- Filter composition: all new filters combine with each other and with the existing `companyId`, `search` (notes `$text`), and pagination; `total` reflects the fully filtered set.
- Boundary validation of the new query params (Zod) with appropriate coercion and `422` rejection for invalid values (e.g., invalid `type`, non-ISO `from`/`to`).
- Test-first unit tests (strict_tdd is enabled) for the new filter logic, DTO validation, and repository filtering.
- A new capability spec `remision-search` at `openspec/changes/remision-search-filters/specs/remision-search/spec.md`.

### Out of Scope
- Adding the same filters to the `company`, `client`, or `driver` list endpoints — this change is remision-only.
- Denormalizing `clientName`/`driverName` onto the remision document (approach (c) below) — deferred.
- Mongo Atlas Search, `$lookup`/`$facet` aggregation rewrites (approach (a) below), or `search-after`/cursor pagination.
- Filtering by remision `items` content, `consecutive`, or monetary totals.
- Sorting controls (existing `createdAt`/textScore sort is unchanged).
- Any frontend/client changes — this repository is backend-only.

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### New Capabilities
- `remision-search`: Search and filtering for the remision list endpoint — client-name and driver-name matching, exact `type` filter, and `createdAt` date-range filter, composing with existing `search`, `companyId`, and pagination.

### Modified Capabilities
- None

> Note for the spec phase: `api-pagination`'s "Pagination Composes with Existing Filters" requirement enumerates only `search` and `companyId`. The `remision-search` capability SHOULD state its own composition-with-pagination requirement (total reflects the filtered set). If the spec agent decides the `api-pagination` spec must also enumerate the new filters, that becomes a MODIFIED delta on `api-pagination` — flag this rather than silently expanding the stable spec.

## Approach

**Recommended name-search strategy: two-step id resolution (option (b)).** When `clientName` and/or `driverName` are supplied, run a case-insensitive substring query (escaped regex) against the `Client`/`Driver` collections' `name` field to collect matching ids, then add `filter.clientId = { $in: ids }` and/or `filter.driverId = { $in: ids }` to the remision query. This keeps `listByOwner` on `find()` (no `find → aggregate` rewrite) and keeps `countDocuments(filter)` working against the same filter for an accurate `total`.

Rationale vs. alternatives:
- **(a) `$lookup` aggregation** joins `Client`/`Driver` at query time but forces `listByOwner` from `find` to `aggregate` and `countDocuments` to `$facet`/`$count`, and `Remision.clientId`/`driverId` are currently **not indexed**, so the join would degrade. Higher complexity, more invasive.
- **(c) Denormalize `clientName`/`driverName`** onto the remision document gives the fastest query but adds write-time maintenance (populate on create/update, plus sync on client/driver rename) and a new text index. Deferred as future work.
- Two-step (b) is constant (2–3 queries regardless of dataset), reuses the existing pattern (`RemisionUseCases.listMine` already enriches names via `clientRepo.findByIds`), and preserves the current pagination/text-search code path.

**Where resolution lives:** resolve name → ids in the application layer (`RemisionUseCases.listMine`) by adding a name-search helper to the `Client`/`Driver` repositories, and pass the resolved id arrays (plus `type`, `from`, `to`) down to the repository. This keeps `RemisionRepository` a dumb filter builder. Consequence: `RemisionUseCases` and the DI container must also receive `IDriverRepository` (currently it only receives `clientRepo`), and `IDriverRepository` needs a name-search/`findByIds`-style helper mirroring `IClientRepository.findByIds`.

**Interface shape:** refactor `IRemisionRepository.listByOwner(ownerId, companyId?, search?, pagination?)` to accept a filters object (e.g. `listByOwner(ownerId, filters, pagination)` with `filters = { companyId?, search?, clientIds?, driverIds?, type?, from?, to? }`) rather than growing a 7-positional-arg signature.

**Type filter:** direct exact field — `filter.type = type` (validated to the `priced` | `quantity_only` enum at the boundary).

**Date filter:** `from`/`to` ISO dates mapped to `filter.createdAt = { $gte: from, $lte: to }` (inclusive; each bound optional, both may combine). Exact end-of-day semantics for date-only `to` is an open product decision (see Unresolved Decisions).

**Name semantics:** case-insensitive substring via escaped regex (`new RegExp(escapeRegex(name), "i")`) for predictable "contains" behavior, rather than `$text` (word/stem-based, not substring). The existing `$text` search over `notes` is retained unchanged and composes with the new filters.

**Boundary validation:** the current `paginationQuerySchema` uses `.passthrough()` and the controller reads `companyId`/`search` manually. Introduce a dedicated remision list query schema for `type` (enum), `from`/`to` (ISO datetime coercion), and optional string trimming for `clientName`/`driverName`, applied via the existing `validate(schema, "query")` middleware alongside `paginationQuerySchema`; the controller then reads the validated values.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/repositories/IRemisionRepository.ts` | Modified | Change `listByOwner` to accept a filters object (`clientIds?`, `driverIds?`, `type?`, `from?`, `to?`) instead of only positional `companyId`/`search` |
| `src/infrastructure/repositories/RemisionRepository.ts` | Modified | Build the combined Mongo filter (owner + company + search + `$in` ids + `type` + `$gte/$lte` date) for both `find` and `countDocuments` |
| `src/domain/repositories/IClientRepository.ts` | Modified | Add a name-search helper (or generalize) to resolve `clientName` → ids |
| `src/infrastructure/repositories/ClientRepository.ts` | Modified | Implement client name-search (escaped case-insensitive regex over `name`) |
| `src/domain/repositories/IDriverRepository.ts` | Modified | Add a name-search helper (mirroring `IClientRepository`) to resolve `driverName` → ids |
| `src/infrastructure/repositories/DriverRepository.ts` | Modified | Implement driver name-search (escaped case-insensitive regex over `name`) |
| `src/application/use-cases/remision/RemisionUseCases.ts` | Modified | `listMine` accepts new filters, resolves names → ids, passes filters to repository; constructor gains `IDriverRepository` |
| `src/application/dtos/remision-list-query.dto.ts` (or extend `pagination.dto.ts`) | New | Zod schema for `clientName`, `driverName`, `type`, `from`, `to` with coercion + `422` rejection |
| `src/presentation/http/controllers/remision.controller.ts` | Modified | Read and pass the new validated query params to `listMine` |
| `src/presentation/http/routes/remision.routes.ts` | Modified | Apply the new query schema via `validate(..., "query")` on `GET /` |
| `src/di/container.ts` | Modified | Inject `driverRepository` into `RemisionUseCases` |
| `src/infrastructure/database/models/Remision.model.ts` | Optional | Add indexes on `clientId`/`driverId` to support `$in` filtering at scale (currently unindexed) |
| `src/application/use-cases/remision/RemisionUseCases.test.ts` | New/Modified | Tests for name→id resolution and filter composition |
| `src/infrastructure/repositories/RemisionRepository.test.ts` | Modified | Tests for `$in`, `type`, and date-range filter construction |
| `openspec/changes/remision-search-filters/specs/remision-search/spec.md` | New | Capability spec for remision list search/filters |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Interface signature change (`listByOwner`) and new `RemisionUseCases` dependency ripple across repository, use case, controller, routes, and DI container; a missed consumer breaks the build. | Med | Single mechanical pattern; `bun run build` type check + strict_tdd unit tests catch missed call sites. |
| Name→id resolution returns a large id array (`$in` on unbounded ids) on very common names, hurting query performance. | Med | Scope `$in` to the same `ownerId`/`companyId` already applied; consider optional `clientId`/`driverId` indexes (flagged in Affected Areas). |
| Regex name search is not index-friendly (case-insensitive substring scans the Client/Driver collections). | Med | Client/Driver datasets are typically small; retain `$text` indexes for the existing `search` path; document denormalization as the scale fallback. |
| Date-range semantics (inclusive vs exclusive, date-only vs datetime, timezone) differ from user expectation. | Med | Resolve semantics explicitly in specs (RFC 2119); validate `from <= to` at the boundary. |
| New filters leak into `req.query` via `.passthrough()` if a dedicated schema is not applied, causing unvalidated values to reach the controller. | Low | Apply the dedicated query schema on the remision list route; `validate` replaces `req.query` with parsed data. |
| Escaping regex user input is forgotten, causing regex-injection/DoS. | Med | Central `escapeRegex` helper + test with regex metacharacters. |

## Rollback Plan

1. Revert `IRemisionRepository.listByOwner` and `RemisionRepository` to the positional `(ownerId, companyId?, search?, pagination?)` signature and filter building.
2. Revert `RemisionUseCases.listMine` and its constructor/DI change (remove `IDriverRepository`), restoring the current name enrichment.
3. Revert the new name-search helpers on `IClientRepository`/`IDriverRepository` (or mark them unused).
4. Revert the remision list query schema and the route/controller wiring.
5. Remove the optional `clientId`/`driverId` indexes if added (or leave them; they are additive and harmless).
6. Delete/adjust the added test files.
7. Verify with `git status`, `bun run build`, and `bun test`.

## Dependencies

- Mongoose 8 (already in use) supports `$in`, `$gte`/`$lte`, and `countDocuments` — no aggregation required for the recommended approach.
- Zod (already in use) supports `z.enum`, `z.coerce.date()`, and `.optional()` for query validation.
- Existing `validate(schema, "query")` middleware already supports query-source validation.
- Existing `IClientRepository.findByIds` pattern to mirror for driver name-search.
- No new npm dependencies required.

## Success Criteria

- [ ] `GET /remisiones` accepts `clientName`, `driverName`, `type`, `from`, and `to` query params and returns only matching remisiones.
- [ ] `type` accepts only `priced` or `quantity_only`; invalid values are rejected with HTTP 422.
- [ ] `from`/`to` accept ISO dates; invalid/`from > to` combinations are rejected with HTTP 422.
- [ ] `clientName`/`driverName` match case-insensitively as substrings of the respective `name` field.
- [ ] New filters compose with existing `search`, `companyId`, and pagination; `total` reflects the fully filtered set.
- [ ] `bun test` passes with new unit tests for filter construction, DTO validation, and name→id resolution.
- [ ] `bun run build` succeeds with no TypeScript errors across the modified interfaces and consumers.

## Unresolved Product Decisions

> Returned to the orchestrator; do NOT infer consent.

1. **Name-match field scope** — should `clientName`/`driverName` match only the `name` field, or also `documentId` (and `vehiclePlate` for drivers)? Recommended: name-only substring; confirm.
2. **Driver interpretation** — the objective says "driver (conductor)"; confirm this means *driver name* substring (not license/plate/document).
3. **Date-range semantics** — is `to` inclusive and, when date-only (e.g. `to=2026-01-31`), should it mean end-of-day (inclusive whole day) or `00:00:00`? Recommended: inclusive `$gte from` / `$lte to`, with date-only `to` normalized to end-of-day; confirm timezone basis (UTC vs server-local).
4. **Query param naming** — confirm `clientName` / `driverName` / `type` / `from` / `to` (alternatives: `conductor`, `startDate`/`endDate`).
5. **Existing `search` (notes `$text`)** — keep it composing alongside the new filters (recommended), or replace/repurpose it? Confirm.
