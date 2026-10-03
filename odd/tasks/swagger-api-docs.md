# Feature: swagger api docs

**Status**: closed — commits `47544b9`, `5badfca`, `2e3b0ab`, `3bc0232`; native review approved; PR #7
**Origin**: new requirement — OpenAPI/Swagger documentation for the whole API
**Branch**: `feat/swagger-api-docs`, stacked on `feat/remision-per-item-iva` (PR #6)

## Goal

Serve a generated OpenAPI 3.0.3 document plus a Swagger UI page for all 29 endpoints in the
6 modules, derived from the existing Zod DTOs so the spec cannot drift from the validation
contract.

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Source of truth | **Generated from the Zod DTOs** with `@asteasolutions/zod-to-openapi` (runtime dependency) |
| 2 | Scope | **The whole API** — 29 endpoints plus `/health` |
| 3 | Exposure | **Env-gated**: on by default outside production, off in production unless `ENABLE_API_DOCS=true` |

Derived decisions taken by the parent:

- **OpenAPI 3.0.3**, not 3.1, for the broadest tooling support (Swagger UI, Postman, codegen).
- **UI hosting: CDN, not bundled assets.** `vercel.json` rewrites everything to `/api/index`,
  so serving `swagger-ui-express` assets from `node_modules` in a serverless function is
  fragile. The app serves the spec as JSON and a minimal HTML page loads Swagger UI from a
  CDN. No extra runtime dependency for the UI.

## Integration traps (found while exploring, must be handled)

1. **helmet's default CSP blocks the CDN.** `server.ts:37-39` calls `helmet({ crossOriginResourcePolicy })`
   with the default `contentSecurityPolicy`, whose `script-src 'self'` refuses an external
   Swagger UI bundle. The docs route needs a route-scoped helmet override that allows the CDN
   for `script-src`/`style-src`/`font-src`/`img-src` **without weakening the global CSP**.
2. **`z.coerce.boolean()` treats the string `"false"` as `true`.** `ENABLE_API_DOCS` must be
   parsed explicitly (an `enum(["true","false"]).optional()` plus a post-parse default derived
   from `NODE_ENV`), never coerced.
3. **The response contract has no Zod schema today.** Entities are TypeScript interfaces, so
   response schemas must be written in the docs layer. To stop them drifting from the
   entities, add a compile-time equality guard (a type-level assertion that the inferred
   schema type equals the entity type) so a mismatch fails `tsc --noEmit`.
4. **`env.ts` calls `process.exit(1)` on invalid env.** The new variable must be optional so
   the existing CI env set keeps working.
5. **Adding a dependency changes `bun.lock`.** Install with `bun add`, and keep the existing
   `bun test` suite green (171 tests) — the docs work must not alter validation behaviour.

## What the spec must contain

- **All paths**: `/api/auth` (4), `/api/users` (5), `/api/companies` (5), `/api/clients` (5),
  `/api/drivers` (5), `/api/remisiones` (5), plus `/health`.
- **Security**: a `bearerAuth` HTTP bearer scheme, with per-operation `security` — public for
  `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `/health` and
  the docs routes; bearer for everything else. Document `authorize("admin")` on `GET /api/users`.
- **Envelopes**: success `{ success: true, data, message }`; error
  `{ success: false, message, details? }`.
- **Error responses per operation**: 401, 403, 404, 422 (validation, with the flattened
  `details`), 429 (rate limit), 409 (duplicate key), 500 — only where actually reachable.
- **The remisión per-item IVA contract** (`odd/tasks/remision-per-item-iva.md`): the item shape
  with `hasIva` required, `ivaPercentage` required when taxed, `ivaValue` derived and never
  accepted; the optional aggregate cross-check and its 422; the per-item-then-sum rounding rule;
  and the 422 that a `PATCH` without items raises on a historical priced document. Include
  request and response examples with real numbers (subtotal 200, one taxed and one exempt item,
  `ivaValue` 19, `total` 219).
- **Refinements as prose.** OpenAPI cannot express conditional cross-field rules, so the
  `hasIva`/`ivaPercentage` contradiction, the `priced` ⇒ `unitPrice` rule and the retention
  rule are documented in operation descriptions, not as schema constraints.

## Slicing

The whole API is far past the 400-line review budget, so it is delivered as two cohesive work
units on the same branch, one commit each:

- **Unit 1** — infrastructure (dependency, env gating, registry, UI, server wiring, envelope,
  security scheme, error schemas, entity response schemas with the drift guard, docs tests,
  README) **plus the `/api/remisiones` module fully documented**, because it carries the
  richest and most recently changed contract.
- **Unit 2** — the remaining 5 modules (auth, users, companies, clients, drivers) on top of the
  unit 1 infrastructure.

The split is cohesive: unit 2 only adds path registrations and response schemas against an
infrastructure that unit 1 already proved with tests.

## Tasks

### Unit 1 — infrastructure + remisiones

- [x] 1. Add `@asteasolutions/zod-to-openapi` and install it (`bun add`), keeping `bun.lock` in sync
- [x] 2. `ENABLE_API_DOCS` in `src/config/env.ts` (explicit parsing, default from `NODE_ENV`) and in `.env.example`
- [x] 3. Docs layer: envelope, error and entity response schemas with the compile-time drift guard
- [x] 4. Registry + document builder emitting OpenAPI 3.0.3 with the bearer security scheme
- [x] 5. Register the remisiones paths (5) and `/health` with examples and error responses
- [x] 6. Serve `/api-docs` (spec JSON) and the Swagger UI page from a CDN, gated by the flag, with a route-scoped helmet CSP override
- [x] 7. RED/GREEN: docs tests — path inventory, security per operation, the remisiones IVA contract, the envelope, and the gating on/off
- [x] 8. README: the docs endpoint, how to enable it in production, and how to regenerate
- [x] 9. Verify: `bun test`, `bun run typecheck`, `bunx biome check .`

### Unit 2 — remaining modules

- [x] 10. Register auth (4), users (5), companies (5), clients (5), drivers (5) with their schemas and error responses
- [x] 11. Tests for the full inventory (16 path items / 30 operations) and per-module security
- [x] 12. Verify and update the README endpoint tables to point at the docs

## Non-goals

- No change to validation behaviour, routes, or the response contract.
- No API versioning, no code generation, no SDK.
- No auth on the docs routes beyond the env gate.
- No bundled Swagger UI assets.

## Evidence

- **RED** — greenfield module-resolution failure (`Cannot find module './openapi.js'`) captured before
  the implementation, reported as what it is rather than dressed up as a behavioural RED.
- **GREEN** — `bun test`: **179 pass / 0 fail / 450 expect() calls**, 23 files (171 pre-existing + 8 new).
  `bun run typecheck` clean. `bunx biome check .` clean (101 files).
- **Independent verification** (gentle-ai-verify, read-only) — 7/7 audit questions VERIFIED:
  - the **drift guard is not vacuous**: a control compiled without `@ts-expect-error` fails with
    `TS2344`, and an extra field, a missing field and a changed type are all caught; the guards are
    reachable from the build graph (`server.ts` → `openapi.ts` → `schemas.ts`), not dead code;
  - the document is **OpenAPI 3.0.3** with `bearerAuth`, `security: []` on `/health` and
    `[{bearerAuth: []}]` on all five remisiones operations, and responses emit `$ref`s;
  - the request schemas carry the **real DTO constraints** (`items.required = [description, quantity,
    hasIva]`, `ivaPercentage` 0..100, the 24-hex pattern, `minItems: 1`) — no hand-made copy;
  - **gating** verified in both directions through an env-module mock (no `process.env` mutation),
    absent when off (404, not 401/403), and the docs routes are not behind `authenticate`;
  - the **CSP override is route-scoped**: the global `helmet` configuration is untouched and
    `'unsafe-inline'` is genuinely required by the inline Swagger UI bootstrap;
  - the **env derivation** is correct in all four combinations, and an absent value can never trigger
    `process.exit`;
  - **no pre-existing test was weakened or deleted** (179 − 8 = 171 baseline), and the transient
    `authorize.test.ts` timeout reported by the writer is pre-existing `mongodb-memory-server`
    flakiness — not reproduced in 3/3 full runs and unrelated to this unit.
- **Version decision (verified)** — the latest `9.1.0` requires `zod ^4.0.0` while this repo runs
  `zod 3.25.76`, so `7.3.4` (`zod ^3.20.2`) is the correct line. Pinned exactly and the rationale is
  recorded in the README so a future `bun update` is not blind.
- **Post-verification cleanup** — removed the unreferenced `SuccessEnvelope` component the verifier
  flagged (it would have shipped a dangling component) and folded the envelope shape into one
  definition that the per-operation builder extends. Spec re-checked: 3 paths, 4 components, `$ref`
  on the 201 payload.
- **Unit 1 scope** — 2 path items plus `/health`, 6 operations. The 30-path goal is unit 2.

### Unit 2 evidence

- **GREEN** — `bun test`: **184 pass / 0 fail / 511 expect() calls**, 23 files (179 after unit 1, plus
  4 new tests and 1 more for the spec gaps below). `tsc --noEmit` clean, `biome check .` clean.
- **Inventory observed from the built document**: 16 path items, 30 operations, 15 components; public
  operations are `/health`, `register`, `login` and `refresh`.
- **Independent verification** (gentle-ai-verify, read-only) — the writer declared test-first
  "not applicable" for this unit, so the verifier compensated by proving the new tests **can** fail:
  removing a path registration, flipping an operation's `security` and inlining a `$ref` each broke
  the corresponding assertion. It also confirmed the 8 new drift guards are bidirectional (extra and
  missing fields both fail `tsc` with `TS2344`, control included), that two non-remisión request
  bodies match their DTOs exactly, that `GET /api/users` really is unpaginated, and that nothing
  pre-existing was weakened.
- **Three spec gaps the verification found, all fixed before the commit** — a spec that lies by
  omission is worse than no spec:
  1. `PATCH /api/companies/{id}` can return 409 (unique index `{ownerId, nit}` plus an unchecked
     update) and did not document it. Now documented, with the reason.
  2. The clients and drivers lists accept `companyId` and `search` (the controllers read them and
     `paginationQuerySchema` is `.passthrough()`), but only `limit`/`page` were documented. Now
     declared per module — and the companies list correctly gets `search` only, because it does not
     read `companyId`.
  3. `registerSchema` requires an uppercase, a lowercase and a digit, but zod-to-openapi can emit
     only one `pattern`, so the spec showed just `[A-Z]`. The full rule is now prose in the operation
     description, consistent with how the other non-expressible refinements are handled.
- **Known limitations, stated rather than hidden** — `TokenPair`, `RegisterData` and `LoginData` have
  no entity interface to guard against (they are derived from the auth use-case return types), and
  the inline `/health`, refresh and logout bodies are unguarded by construction. The `$ref` assertion
  catches refId-less inlining only: swapping in the registered schema keeps the refId, so that test is
  narrower than it looks.
- **API inconsistencies surfaced by documenting them** — `POST /api/auth/refresh` returns
  `{success, data}` and `POST /api/auth/logout` returns `{success, message}`; neither follows the
  `{success, data, message}` envelope the rest of the API uses, and both are documented faithfully
  instead of forced into the shared envelope. `GET /api/users` is also unpaginated while clients,
  companies and drivers paginate.

## Review and delivery

- **Native review** — lineage `review-6b275b82ac90fbb3` over the committed slice `8a8245d..5badfca`:
  tier medium, lens `review-reliability`, 2181 changed lines, correction budget 200. State `approved`,
  authority burned (`gentle-ai.review-acknowledged/v1`). Three advisory, non-blocking findings, no
  correction opened:
  - `R3-csp-coverage` — `server.ts:130-141`, the route-scoped CSP override.
  - `R3-docs-import-coupling` — `server.ts:19-20`: the docs modules were imported eagerly and loaded
    at boot even with the flag off. **Fixed** in `2e3b0ab`, which moves both imports inside the route
    handlers; the gating tests exercise that dynamic path.
  - `R3-env-flag-coverage` — `env.ts:47-50`: the flag derivation has no test of its own, because the
    docs tests mock the env module.
- **Commits** — `47544b9` (unit 1: infrastructure + remisiones), `5badfca` (unit 2: the other five
  modules), `2e3b0ab` (lazy docs import), `3bc0232` (untrack the generated skill-registry artifacts).
- **PR #7** — stacked on PR #6, base `feat/remision-per-item-iva`. `ci`, Vercel, Vercel Preview
  Comments and GitGuardian all green.
- **Merge order** — #5 → #6 → #7.

## Follow-ups (accepted, deliberately not done)

- `R3-env-flag-coverage` and `R3-csp-coverage` from the review above.
- The three API inconsistencies the spec surfaced: the `refresh`/`logout` envelope, the unpaginated
  `GET /api/users`, and the register password rule OpenAPI cannot express in full. **Deferred by the
  user**: they are API changes, not documentation changes, so they stay mapped rather than fixed here.
- Per-field descriptions in the spec: the DTO files were deliberately kept out of the docs work, so
  descriptions live at schema and operation level only. Enriching them means adding `.openapi()`
  metadata to the DTOs, which is its own unit.
- `.atl/skill-registry*` are no longer tracked, so they stop appearing as workspace changes in every
  review preflight.
