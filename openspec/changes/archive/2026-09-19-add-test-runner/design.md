# Design: Add Test Runner and Initial Unit Tests

## Technical Approach

Adopt Bun's built-in `bun:test` framework — it ships with the Bun runtime already used by this project, requires **zero new dependencies**, and discovers `*.test.ts` files by default with no config file. Tests are co-located with their source files (`*.test.ts` next to the module under test) and use **relative imports** to match the codebase's existing convention (source files import with relative paths + `.js` extension despite the `@/*` alias being declared in `tsconfig.json` — see Architecture Decision 3).

During codebase inspection, one discrepancy with the proposal/spec was found and resolved:

> **Critical finding**: `Remision` (`src/domain/entities/Remision.ts`) is a **plain type-only interface** — it has no `computeTotals` method. The actual total computation is a **module-private function** `computeTotals(items, type, ivaPercentage)` inside `src/application/use-cases/remision/RemisionUseCases.ts` (lines 16–32). It is currently untestable because it is not exported.

The design therefore extracts `computeTotals` into a pure, exported domain helper (`src/domain/services/remisionTotals.ts`) and tests it directly. This satisfies the spec's "Remision Total Computation Unit Tests" requirement without mocking repositories or other collaborators, and aligns the logic with Clean Architecture (monetary math belongs in `domain`, not `application`).

Testing is strictly limited to **pure logic**: total math, Zod schema pass/fail, and the `AppError` hierarchy. No MongoDB, no `process.env` secrets, no HTTP layer, no mocks of infrastructure. Integration testing is explicitly deferred.

## Architecture Decisions

### Decision 1: Extract `computeTotals` to a pure domain service

**Choice**: Move `computeTotals` from `RemisionUseCases.ts` into a new exported file `src/domain/services/remisionTotals.ts`; `RemisionUseCases.ts` imports it. Add a `ValidationError` throw when any priced item has a negative `unitPrice` (spec scenario: "does NOT produce a negative subtotal from invalid input" — the throw branch was chosen; note `createRemisionSchema` already rejects negative `unitPrice` at the boundary, so this is a defense-in-depth guard for the pure function).

**Alternatives considered**:
- *(a)* Export `computeTotals` directly from `RemisionUseCases.ts` and test it there — rejected: the function is not a use-case responsibility; exporting from an application-layer file full of repo-dependent classes couples tests to the wrong module and blurs layer boundaries.
- *(b)* Inline-test through `RemisionUseCases.create()` with mocked repositories — rejected: requires replicating company-lookup, ownership, consecutive-generation mocks solely to reach a pure arithmetic call; brittle and violates "no infrastructure dependencies".
- *(c)* Add a method to the `Remision` interface — rejected: `Remision` is a data shape, not behavior; adding methods would force every consumer/mapper to implement or extend it, a much larger refactor than this change warrants.

**Rationale**: Extraction is the smallest change that makes the exact logic the spec targets directly testable as a pure function, keeps behavior bit-identical (same reduce, same `.toFixed(2)` truncation), respects the existing layering (domain → application dependency direction), and produces a single new file plus a two-line import edit.

### Decision 2: Co-located `*.test.ts` files, not a `tests/` directory

**Choice**: Place tests next to sources: `src/domain/services/remisionTotals.test.ts`, `src/application/dtos/auth.dto.test.ts`, `src/application/dtos/remision.dto.test.ts`, `src/shared/errors/AppError.test.ts`.

**Alternatives considered**:
- A central `tests/unit/` directory mirroring `src/` — rejected: creates duplicated directory trees whose relative-import paths drift out of sync with refactors; co-location is Bun's default discovery model and keeps test + code visible together.

**Rationale**: Matches the proposal's stated convention, Bun's zero-config discovery, and this project's Clean Architecture module layout where each bounded area (`domain`, `application`, `shared`) is self-contained.

### Decision 3: Relative imports in tests (no `@/*` aliases)

**Choice**: All test files import modules with relative paths and explicit `.js` extensions, e.g. `import { computeTotals } from "./remisionTotals.js";`.

**Alternatives considered**:
- Use `@shared/errors/AppError.js` style aliases — rejected: although `tsconfig.json` declares `@/*`, **every source file in the codebase uses relative imports** (verified: `RemisionUseCases.ts`, `AppError.ts` consumers). `bun test` would additionally require bunfig/tsconfig-paths-aware resolution to work reliably; adopting aliases everywhere is a separate, larger change.

**Rationale**: The design must follow the existing codebase pattern (skill rule: use the project's actual conventions not aspirational ones); relative imports guarantee the runner resolves modules with zero extra configuration.

### Decision 4: No `bunfig.toml` — Bun defaults are sufficient

**Choice**: Do not create a `bunfig.toml`. Rely on Bun's defaults: `bun test` matches `*.test.{js,jsx,ts,tsx}` (and `*_test.*`) recursively; `bun test --watch` enables watch mode; `bun test --coverage` enables coverage.

**Alternatives considered**:
- A minimal `bunfig.toml` with `[test] root = "src"` — rejected: project root *is* `src`'s parent and no out-of-tree `*.test.ts` files exist or are planned; the file would be dead configuration. Note the spec scenario `.spec.ts` files are correctly **not** matched by Bun defaults, satisfying "Non-conforming test files are ignored" without any config.

**Rationale**: Fewer configuration surfaces = fewer failure modes. If a future change introduces exotic root paths or preload hooks, `bunfig.toml` can be added then.

### Decision 5: Include a `test:coverage` script ( Proposal's "optionally" resolved as yes)

**Choice**: Add three scripts to `package.json`:
```json
"test": "bun test",
"test:watch": "bun test --watch",
"test:coverage": "bun test --coverage"
```

**Alternatives considered**:
- Skip coverage until CI wiring — rejected at near-zero cost: the flag is built into Bun, and `openspec/config.yaml` has a `coverage_command` field that would otherwise remain `null` without any technical reason.

**Rationale**: Bun's coverage is dependency-free; the SDD workflow can later reference `coverage_command: bun test --coverage`. Coverage thresholds are intentionally NOT configured (out of scope per proposal).

### Decision 6: `AppError.isOperational` semantics — test base-class behavior as-is

**Choice**: Test `AppError` with its existing constructor (`message`, `statusCode=400`, optional `details`), asserting the default `isOperational: true`. For the spec's "Non-operational errors are flagged correctly" scenario, subclass-locally: a test-local `class NonOperationalError extends AppError { constructor(m: string){ super(m, 500); } }` overriding `isOperational = false` post-construction is **not** added — instead, the test asserts the *current contract*: all constructors/subclasses produce `isOperational === true` (operational by default), plus a negative instanceof check against plain `Error`, and per-subclass status codes (404/401/403/409/422).

**Alternatives considered**:
- Add a `isOperational` constructor parameter to `AppError` to enable true non-operational cases — rejected: that is a behavior change to production error handling beyond this change's scope (proposal explicitly defers error-handling refactors; spec scenario "or without the operational flag" is satisfied because the field is read-only `true` and a plain `Error` is never an `AppError`).

**Rationale**: Zero spec-complaint without touching production code. `AppError.ts` is verified-ready for testing as-is: it already exposes `statusCode`, `isOperational` (readonly), `details`, and 5 concrete subclasses (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError`) mapping to 404/401/403/409/422. `Error.captureStackTrace` works on Node/Bun without modification.

## Data Flow

Testing infra adds no data-flow change. Test execution flow only:

```
bun test (scripts.test)
   │ discovers *.test.ts recursively from project root (default glob)
   ▼
Test files (co-located, relative imports)
   ├─ src/domain/services/remisionTotals.test.ts  ── imports → remisionTotals.ts        (pure)
   ├─ src/application/dtos/auth.dto.test.ts       ── imports → auth.dto.ts (zod schemas) (pure)
   ├─ src/application/dtos/remision.dto.test.ts   ── imports → remision.dto.ts (zod)    (pure)
   └─ src/shared/errors/AppError.test.ts          ── imports → AppError.ts               (pure)
   ▼
exit 0 on success / non-zero on failure; --coverage adds text + coverage/ dir
```

No Mongo connection, no environment variables, no HTTP server is booted by any of these tests.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/domain/services/remisionTotals.ts` | Create | Extracted pure `computeRemisionTotals(items, type, ivaPercentage?)` returning `{ subtotal, ivaValue, total }` (`quantity_only` → all `undefined`); throws `ValidationError` on negative `unitPrice` |
| `src/domain/services/remisionTotals.test.ts` | Create | Pure-math tests: priced items, empty array, mixed types, `quantity_only`, rounding to 2 decimals, negative `unitPrice` rejection |
| `src/application/dtos/auth.dto.test.ts` | Create | Zod tests for `registerSchema`, `loginSchema`, `refreshSchema`: valid path, invalid email, weak password (each regex/length), short token |
| `src/application/dtos/remision.dto.test.ts` | Create | Zod tests for `createRemisionSchema` (valid, missing required, non-hex id, negative qty/price, non-empty items, `priced` without `unitPrice`) and `updateRemisionSchema` (partial updates accepted) |
| `src/shared/errors/AppError.test.ts` | Create | Hierarchy tests: instanceof AppError, subclass status codes 404/401/403/409/422, operational default, message/details passthrough, plain `Error` NOT instanceof |
| `src/application/use-cases/remision/RemisionUseCases.ts` | Modify | Replace inline `computeTotals` function with import from `src/domain/services/remisionTotals.ts` (call sites at lines 54/95 unchanged in shape) |
| `package.json` | Modify | Add `test`, `test:watch`, `test:coverage` scripts |
| `openspec/config.yaml` | Modify | `testing.runner: bun`, `test_command: bun test`, `coverage_command: bun test --coverage`, `projects[0].test_command: bun test`, `framework: bun:test`, `test_layers.unit: true`, `coverage: true`; drop "No test runner or tests configured yet." from `context` |

New: 5 · Modified: 3 · Deleted: 0. **No application behavior changes** beyond moving `computeTotals` out of the use-case module (plus the new negative-price guard inside it, which previously was recessively validated only at the DTO layer).

## Interfaces / Contracts

### Extracted domain service contract

```ts
// src/domain/services/remisionTotals.ts
import { ValidationError } from "../../shared/errors/AppError.js";
import type { RemisionItem } from "../entities/Remision.js";

export interface RemisionTotals {
	subtotal: number | undefined;
	ivaValue: number | undefined;
	total: number | undefined;
}

export function computeRemisionTotals(
	items: RemisionItem[],
	type: "priced" | "quantity_only",
	ivaPercentage?: number,
): RemisionTotals;
```

Behavior contract (drives the unit tests):
- `type === "quantity_only"` → `{ subtotal: undefined, ivaValue: undefined, total: undefined }` (existing behavior preserved).
- `priced` → `subtotal = Σ (quantity × unitPrice ?? 0)`, `ivaValue = round2(subtotal × iva/100)`, `total = round2(subtotal + ivaValue)`; missing `ivaPercentage` treated as `0`. Rounding via `.toFixed(2)` exactly as today.
- Any item with `unitPrice !== undefined && unitPrice < 0` → throws `ValidationError` (422), satisfying "does NOT produce negative subtotal from invalid input".

### Test conventions (shared, no shared utility file needed yet)

- `import { describe, expect, test } from "bun:test";` — explicit imports, no reliance on Bun's global autopatch.
- Factories build plain object literals typed with entity/DTO imports; **no helper module is introduced** since each suite needs < ~20 lines of fixtures. Revisit only if duplication grows beyond this change.
- Zod assertions use `schema.safeParse(input)` and pattern on `{ success: true, data }` / `{ success: false, error }` — never throw-expected for validation (negative testing via `safeParse` keeps suites side-effect free).
- Error-class tests assert `error.statusCode`, `error.isOperational`, `error instanceof AppError`, `error.name === "Error"` semantics only via public fields; no snapshot tests.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `computeRemisionTotals` arithmetic, `quantity_only` short-circuit, rounding, negative-price rejection | Direct call to exported pure function; `expect(x).toEqual(...)` numeric assertions |
| Unit | Zod schemas (`auth.dto.ts`, `remision.dto.ts`): accept valid, reject malformed/missing/constraint-violating inputs | `safeParse` success/failure shape assertions, including refinement message for `priced` items missing `unitPrice` |
| Unit | `AppError` hierarchy: instanceof, subclass factories and their status codes, operational flag, details passthrough, plain-`Error` exclusion | Direct instantiation and `instanceof` checks; no subclassing, no mocking |
| Integration | Deferred: repository CRUD, JWT/password services, HTTP controllers/middleware | Explicitly out of scope (requires Mongo/mock-seeded infra; deferred per proposal) |
| E2E | Deferred | Out of scope |

No test relies on: `process.env`, `mongoose.connect`, network, timers, or file system.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change only adds declarative `package.json` scripts (`bun test` invocations) and pure unit test files; there are no executable-path or shell-argument boundaries to model, and all matrix rows are inapplicable because no automated command runs anything beyond Bun's own test runner on trusted in-repo files.

## Migration / Rollout

No migration required. No data, schema, or environment changes; rollout is immediate on merge. Rollback = revert the 3 modified files + delete the 5 new files, then `bun run build` to confirm clean typecheck.

## Open Questions

- [x] ~~Where does the total-computation logic live?~~ Resolved via codebase inspection: extracted to `src/domain/services/remisionTotals.ts` (Decision 1). Flagging to the orchestrator for spec-awareness since the proposal's "Affected Areas" table pointed at `Remision.ts`, which is a type-only file.
- [ ] `Error.captureStackTrace` on `AppError` — confirmed available in Bun (Node-compat API); expected to be a no-op concern in tests. No action planned; verified during apply.
