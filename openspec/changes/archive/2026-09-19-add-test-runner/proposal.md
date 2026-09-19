# Proposal: Add Test Runner and Initial Unit Tests

## Intent

The project currently has zero automated tests, no test runner, and no coverage reporting. This proposal adds Bun's built-in `bun test` runner plus an initial set of high-value unit tests to establish a testing baseline. Once the test command is reliable, `strict_tdd` can be enabled in `openspec/config.yaml`.

## Scope

### In Scope
- Add a `test` script to `package.json` that invokes `bun test` with appropriate flags.
- Document test conventions (file naming, directory placement, mocking strategy).
- Write initial unit tests for pure, high-value, testable units:
  - `Remision` entity total computation logic (`computeTotals`).
  - Zod DTO validation schemas (at least one representative DTO per layer: auth, remision).
  - `AppError` hierarchy and error classification behavior.
- Update `openspec/config.yaml` to reflect the new runner and test command.
- Add a `test:watch` script for interactive development.

### Out of Scope
- Integration tests that require a real MongoDB instance (deferred to a future change).
- Refactoring static security services (`JwtService`, `PasswordService`) into injectable classes.
- Extracting `assertOwnership` into a shared policy/helper.
- Achieving full code coverage.
- CI/CD pipeline wiring (GitHub Actions, etc.).

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### New Capabilities
- `testing-infrastructure`: Test runner configuration (Bun built-in), conventions, and initial unit test suites for pure domain logic, DTO validation, and error hierarchy.

### Modified Capabilities
- None

## Approach

Leverage Bun's native `bun:test` framework (already bundled with the runtime) so no additional dependencies are required. Tests will be placed alongside source files using the `*.test.ts` co-location pattern (e.g., `src/domain/entities/Remision.test.ts`) to keep tests visible and maintainable. For pure units with no infrastructure dependencies, tests will exercise the logic directly. For DTO validation, tests will assert Zod schema pass/fail cases. For the error hierarchy, tests will verify instance checks (`instanceof`, `isOperational`). `openspec/config.yaml` will be updated to set `testing.runner: bun`, `test_command: bun test`, and `unit: true`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `test`, `test:watch`, and optionally `test:coverage` scripts |
| `openspec/config.yaml` | Modified | Update `testing.runner`, `test_command`, `unit` flags |
| `src/domain/entities/Remision.ts` | Modified | Add `Remision.test.ts` co-located |
| `src/application/dtos/` | Modified | Add representative `*.test.ts` files for Zod schemas |
| `src/shared/errors/AppError.ts` | Modified | Add `AppError.test.ts` co-located |
| `openspec/changes/add-test-runner/specs/` | New | Capability specs for testing infrastructure |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Static security services (`JwtService`, `PasswordService`) are hard to mock in unit tests because they are static classes, not injectable. | Med | Scope keeps these OUT of initial tests; document as known limitation for future refactor. |
| Path alias `@/*` is declared in `tsconfig.json` but source files use relative paths; tests may need extra resolver config if aliases are adopted later. | Low | Use relative imports in test files to match current codebase convention. |
| Tests accidentally depend on infrastructure (MongoDB, env vars) and fail in CI or clean environments. | Med | Strictly limit initial tests to pure logic and DTO validation; avoid any test that touches `mongoose` or `process.env` secrets. |
| `bun test` behavior differs from Jest/Vitest patterns the team may be familiar with. | Low | Document Bun-specific conventions (globals, matchers, lifecycle) in a short `TESTING.md` or inline comments. |

## Rollback Plan

1. Revert `package.json` to remove the `test` and `test:watch` scripts.
2. Revert `openspec/config.yaml` to restore `testing.runner: none`, `test_command: null`, and `unit: false`.
3. Delete all `*.test.ts` files created in this change.
4. Verify rollback with `git status` and `bun run build` to ensure no TypeScript or runtime errors remain.

## Dependencies

- Bun 1.x runtime (already in use).
- No new npm dependencies required (`bun:test` is built-in).

## Success Criteria

- [ ] `bun test` executes successfully from the project root with a non-zero exit code on failure and zero on success.
- [ ] At least one passing test exists for `Remision` total computation logic.
- [ ] At least one passing test exists for Zod DTO validation (both valid and invalid inputs).
- [ ] At least one passing test exists for `AppError` hierarchy (instance checks, operational flag).
- [ ] `openspec/config.yaml` reflects `testing.runner: bun`, `test_command: bun test`, and `unit: true`.
- [ ] `package.json` contains a `test` script and a `test:watch` script.
