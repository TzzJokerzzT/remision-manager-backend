# Apply Progress: Add Test Runner and Initial Unit Tests

## Mode

Standard (single PR, no chained-PR split — the change is ~330 lines and well under the 400-line budget).

## Summary

Implemented the `add-test-runner` change: extracted the private `computeTotals` arithmetic from `RemisionUseCases.ts` into a pure, exported domain service (`computeRemisionTotals`), wired the use case to it, enabled Bun's built-in `bun test` runner via `package.json` scripts and `openspec/config.yaml` metadata, and added 4 co-located pure unit test suites. All 21 tasks completed. `bun test` (25 tests, exit 0) and `bun run build` (tsc --noEmit, exit 0) both pass.

## Completed Tasks

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 — Domain extraction | 1.1–1.6 | ✅ all done |
| Phase 2 — Runner + metadata | 2.1–2.4 | ✅ all done |
| Phase 3 — Test suites | 3.1–3.6 | ✅ all done |
| Phase 4 — Verification | 4.1–4.5 | ✅ all done |

Total: 21 / 21 completed. See `tasks.md` for the checked-off list.

## Files Changed

### Created

| File | Description |
|------|-------------|
| `src/domain/services/remisionTotals.ts` | Extracted pure `computeRemisionTotals(items, type, ivaPercentage?)` returning `RemisionTotals`; preserves exact arithmetic + negative-`unitPrice` `ValidationError` (422) guard |
| `src/domain/services/remisionTotals.test.ts` | 6 tests: priced sum, empty→0, mixed types, `quantity_only`→undefined, 2-decimal rounding, negative price rejection |
| `src/application/dtos/auth.dto.test.ts` | 5 tests: valid register, invalid email, 4 weak-password rules, valid login, short refreshToken |
| `src/application/dtos/remision.dto.test.ts` | 10 tests: valid priced + quantity_only creation, missing fields, non-hex ids, negative qty/price, empty items, priced-missing-unitPrice refinement, partial update |
| `src/shared/errors/AppError.test.ts` | 5 tests: instanceof + message/status, default `isOperational`, 5 subclass codes + instanceof, details passthrough, plain `Error` exclusion |

### Modified

| File | Change |
|------|--------|
| `src/application/use-cases/remision/RemisionUseCases.ts` | Deleted private `computeTotals`; import `computeRemisionTotals`; rewired both call sites (create + update). Also dropped the now-unused `RemisionItem` type import |
| `package.json` | Added `test`, `test:watch`, `test:coverage` scripts; added `bun-types` devDependency (see Deviations) |
| `openspec/config.yaml` | `testing.runner: bun`, `test_command`/`coverage_command` set, `projects[0]` framework/unit/coverage updated, removed "No test runner or tests configured yet." from `context` |
| `tsconfig.json` | `types` array `["node"]` → `["node", "bun-types"]` (see Deviations) |
| `bun.lock` | Updated transitively by `bun add -d bun-types` |

## Deviations from Design

1. **`bun-types` devDependency + `tsconfig.json` `types` change (necessary).** The design stated "zero new dependencies" and assumed `bun test`/`tsc` would typecheck `import ... from "bun:test"` out of the box. Empirically, `tsc --noEmit` fails with `TS2307: Cannot find module 'bun:test'` because no Bun type declarations exist in the project and `types: ["node"]` restricts auto-inclusion. Task 4.3 hard-requires `bun run build` to pass with test files present. Resolved by adding `bun-types` (the actual Bun type declarations, type-only devDependency — no runtime/test-framework dependency) and adding `"bun-types"` to `tsconfig.json` `types`. `@types/bun` was tried first but is only a triple-slash shim that resolves to `bun-types`, which the `types` restriction still blocked; the direct `bun-types` + explicit `types` entry is the robust fix.

2. **Bun's default glob also matches `.spec.ts`.** Design Decision 4 claimed `.spec.ts` files are "correctly not matched by Bun defaults". Empirically verified false: adding a `probe.spec.ts` caused `bun test` to discover 5 files (26 tests). No `.spec.ts` files exist in the repo and none were created, so this has zero functional impact — but the design's claim is inaccurate.

3. **`bun test --coverage` does not generate a `coverage/` directory.** Bun 1.4.2's default coverage reporter is text-only (prints the table); an lcov file/`coverage/` dir requires `--coverage-reporter=lcov` or a `bunfig.toml`, which the design deliberately did not add. Coverage output (100% funcs/lines on the 4 modules under test) IS produced, satisfying the spirit of task 4.2; only the "coverage/ generated" wording is not literally met.

4. **Removed unused `RemisionItem` import.** `computeTotals` was the sole consumer of the `RemisionItem` type in `RemisionUseCases.ts`; after extraction the import became dead and was removed (minor cleanup beyond the stated two-line import swap).

## Issues Found

- **Types gap (blocking, resolved):** `bun:test` has no type declarations in-tree; `tsc --noEmit` fails without them. Fixed via `bun-types` + tsconfig `types` (Deviation 1).
- No other issues. The extraction is behavior-preserving (same reduce, same `.toFixed(2)`, same `quantity_only` short-circuit); the only behavioral addition is the defense-in-depth negative-`unitPrice` guard specified by the design.

## Verification

- `bun test` → `25 pass / 0 fail / 58 expect() calls / Ran 25 tests across 4 files`, **exit 0**.
- `bun test --coverage` → 100% funcs / 100% lines across the 4 modules under test, **exit 0**.
- `bun run build` (`tsc --noEmit`) → clean, **exit 0**.
- No `*.spec.ts` files exist; all 4 suites are discovered by Bun's default `*.test.ts` glob.
- `openspec/config.yaml` reflects `runner: bun`, `test_command: bun test`, `unit: true`; `package.json` exposes `test`, `test:watch`, `test:coverage`.

## Risks

- **Low** — `bun-types` is a direct devDependency but version-pinned as `^1.4.2`; if Bun is later upgraded, `bun-types` should be upgraded in lockstep to avoid type drift.
- **Low** — the `quantity_only` short-circuit is evaluated before the negative-price guard, so a negative `unitPrice` on a `quantity_only` remision does not throw. This matches the existing `computeTotals` behavior (which ignored `unitPrice` entirely for `quantity_only`) and is not exercised by any current caller, but is worth noting if the guard is ever expected to apply uniformly.
- **Pre-existing (untouched):** `README.md` and `src/application/dtos/pagination.dto.ts` already carried uncommitted modifications before this change; they were not altered.
