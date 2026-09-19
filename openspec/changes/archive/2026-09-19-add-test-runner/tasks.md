# Tasks: Add Test Runner and Initial Unit Tests

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300–330 (5 new files ≈ 285 added; 3 modified ≈ 45 changed) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed) |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Make `computeRemisionTotals` a pure, exported domain service and wire the use case to it (behavior-preserving extraction) | PR 1 | `bun run build` (tsc --noEmit) — no tests exist yet at this point | `bun run src/index.ts` boots cleanly OR `bun run build` typechecks (no DB needed for typecheck) | `src/domain/services/remisionTotals.ts` (new) + `src/application/use-cases/remision/RemisionUseCases.ts` (import swap) — deleting the new file and reverting the import restores original state |
| 2 | Enable the Bun test runner (scripts + OpenSpec metadata) and add the 4 initial pure unit suites | PR 1 | `bun test` (expect exit 0, all green) | `bun test` from repo root discovers and runs the 4 co-located suites with no Mongo/env dependency | `package.json`, `openspec/config.yaml`, and the 4 `*.test.ts` files — reverting scripts/config and deleting tests fully rolls back |

> Both work units ship in the same (single) PR; they are sequenced only to keep the extraction verifiable before tests depend on the exported symbol. Estimated total is well under the 400-line review budget.

## Phase 1: Domain Extraction / Foundation

- [x] 1.1 Create `src/domain/services/remisionTotals.ts` (new) exporting `interface RemisionTotals { subtotal: number | undefined; ivaValue: number | undefined; total: number | undefined }` and `computeRemisionTotals(items: RemisionItem[], type: "priced" | "quantity_only", ivaPercentage?: number): RemisionTotals`. Import `ValidationError` from `../../shared/errors/AppError.js` (read-only) and `RemisionItem` as a type from `../entities/Remision.js` (read-only) (relative imports + `.js` extension, matching codebase convention).
- [x] 1.2 Preserve the exact current arithmetic from `RemisionUseCases.ts` lines 16–32: `quantity_only` → all `undefined`; `priced` → `subtotal = Σ(quantity × (unitPrice ?? 0))`, `ivaValue = +(subtotal × iva/100).toFixed(2)`, `total = +(subtotal + ivaValue).toFixed(2)`, `subtotal` returned as `+subtotal.toFixed(2)`, missing `ivaPercentage` treated as `0`.
- [x] 1.3 Add the defense-in-depth guard: if any item has `unitPrice !== undefined && unitPrice < 0`, throw `new ValidationError(...)` (422) instead of computing a negative subtotal.
- [x] 1.4 Update `src/application/use-cases/remision/RemisionUseCases.ts`: delete the module-private `computeTotals` function (lines 16–32) and add `import { computeRemisionTotals } from "../../../domain/services/remisionTotals.js";` (read-only).
- [x] 1.5 Update both call sites in `RemisionUseCases.ts` (create at line 54; update at line 95) to call `computeRemisionTotals(...)` — call shape unchanged.
- [x] 1.6 Run `bun run build` (tsc --noEmit) and confirm it passes with no type errors after the extraction.

## Phase 2: Test Runner Wiring and OpenSpec Metadata

- [x] 2.1 Modify `package.json` `scripts`: add `"test": "bun test"`, `"test:watch": "bun test --watch"`, `"test:coverage": "bun test --coverage"`.
- [x] 2.2 Modify `openspec/config.yaml`: set `testing.runner: bun`, `testing.test_command: bun test`, `testing.coverage_command: bun test --coverage`.
- [x] 2.3 Modify `openspec/config.yaml` `testing.projects[0]`: set `test_command: bun test`, `framework: bun:test`, `test_layers.unit: true`, `coverage: true` (leave `integration`/`e2e` as `false`).
- [x] 2.4 Modify `openspec/config.yaml` `context`: remove the sentence `"No test runner or tests configured yet."` (the project is now test-capable).

## Phase 3: Initial Unit Test Suites

- [x] 3.1 Create `src/domain/services/remisionTotals.test.ts` (new). Import `{ describe, expect, test } from "bun:test"` and `computeRemisionTotals` from `"./remisionTotals.js"`. Cover spec scenarios: priced items sum `quantity × unitPrice`; empty items array → `subtotal === 0` and `total === 0`; mixed `priced`/`quantity_only` items → only priced contribute; `quantity_only` → all three fields `undefined`; 2-decimal rounding via `.toFixed(2)`; negative `unitPrice` → throws `ValidationError` (assert `instanceof` + `statusCode === 422`).
- [x] 3.2 Create `src/application/dtos/auth.dto.test.ts` (new). Use `schema.safeParse(input)` on `registerSchema`, `loginSchema`, `refreshSchema` from `"./auth.dto.js"`. Cover: valid registration → `{ success: true }`; invalid email `"not-an-email"` → `{ success: false }` with an `email`-path issue; weak password rejected per each regex/length rule (min 8, uppercase, lowercase, digit); short `refreshToken` (< 10) rejected.
- [x] 3.3 Create `src/application/dtos/remision.dto.test.ts` (new). Use `safeParse` on `createRemisionSchema` and `updateRemisionSchema` from `"./remision.dto.js"`. Cover: valid creation input → `{ success: true }`; missing required fields (companyId/clientId/items) → `{ success: false }` identifying each; non-hex 24-char ids rejected; negative `quantity` rejected; negative `unitPrice` rejected; empty `items` array rejected; `type: "priced"` item missing `unitPrice` → refinement failure on path `["items"]`; `updateRemisionSchema` accepts partial updates.
- [x] 3.4 Create `src/shared/errors/AppError.test.ts` (new). Import `AppError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, ValidationError` from `"./AppError.js"`. Cover: `new AppError("message", 500)` → `instanceof AppError` true, `message === "message"`, `statusCode === 500`; default `isOperational === true`; subclass status codes 404/401/403/409/422 and all `instanceof AppError`; `details` passthrough on `ValidationError`; plain `new Error(...)` is NOT `instanceof AppError`.
- [x] 3.5 Header comments in each test file documenting conventions (co-located `*.test.ts`, relative imports, `safeParse` over throw-expected, no Mongo/env). No shared fixture/helper module is introduced — each suite keeps its own < ~20-line fixtures.
- [x] 3.6 Confirm no test imports `mongoose`, reads `process.env`, opens network/timers, or touches the file system.

## Phase 4: Verification

- [x] 4.1 Run `bun test` from the project root; confirm exit code 0 and that all 4 suites are discovered and pass.
- [x] 4.2 Run `bun test --coverage`; confirm coverage output is produced and `coverage/` is generated (thresholds intentionally not configured).
- [x] 4.3 Run `bun run build` (tsc --noEmit) again to confirm test files typecheck cleanly under the project tsconfig.
- [x] 4.4 Verify spec "Non-conforming test files are ignored": confirm no `*.spec.ts` files exist and that Bun's default glob discovers only `*.test.ts` (a `Remision.spec.ts` would NOT be run).
- [x] 4.5 Sanity-check `openspec/config.yaml` reflects `testing.runner: bun`, `testing.test_command: bun test`, and `testing.projects[0].test_layers.unit: true`; sanity-check `package.json` exposes `test` and `test:watch`.

## Threat Matrix

N/A — the design's Threat Matrix marks every row inapplicable: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. There are no RED-test tasks to derive from it. The change only adds declarative `package.json` scripts (`bun test` invocations), pure unit test files, and a pure arithmetic extraction; no automated command runs anything beyond Bun's own test runner on trusted in-repo files.
