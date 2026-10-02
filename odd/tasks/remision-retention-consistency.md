# Feature: Remision retention consistency

**Status**: implemented, verified — awaiting commit authorization
**Origin**: read-only review of `140329c` (branch `production`)
**Branch**: pending (currently on `production`)

## Problem

Commit `140329c` added `documentType` and retención en la fuente to `Remision`, but the
update path persisted internally inconsistent documents:

1. **F1 (high)** — `RemisionUseCases.update` computed `retencionValue: undefined` when
   retention was turned off, and `RemisionRepository.update` called
   `findByIdAndUpdate(id, data)`. Mongoose strips `undefined` keys from the update
   document (verified with `_castUpdate`), so the stale `retencionValue` survived while
   `hasRetencion` became `false` and `total` was recomputed without retention.
2. **F2 (high)** — `140329c` added `type` to `updateRemisionSchema`, but
   `computeRemisionTotals` still received `remision.type` while `{ ...dto, ...totals }`
   persisted `dto.type`. Switching type left totals inconsistent with the stored type;
   switching to `quantity_only` left the previous totals behind.
3. **F3 (medium)** — `updateRemisionSchema` required `retencionPercentage` whenever
   `hasRetencion === true`, but the use case already fell back to the stored percentage,
   so `PATCH { hasRetencion: true }` returned 422 even when a percentage was stored.

## Fix design

- **A (adapter)** — `RemisionRepository.update` translates the incoming patch: defined
  values go into `$set`, keys explicitly present as `undefined` go into `$unset`. This
  keeps the domain contract (`subtotal?: number` means absent) and fixes the whole class
  of stale-field bugs, not only retention.
- **B (use case)** — `const type = dto.type ?? remision.type`, passed to
  `computeRemisionTotals` and persisted explicitly.
- **C (boundary alignment)** — removed the refine from `updateRemisionSchema` (a partial
  DTO cannot see stored state) and enforced the invariant in the update use case after the
  stored-value fallback: `hasRetencion === true && retencionPercentage === undefined` →
  `ValidationError` (422). The `create` refine stays, because create has no stored state.
- **Not changed** — `hasRetencion: true` with `retencionPercentage: 0` keeps producing
  `retencionValue: 0` (mathematically correct); intentional, documented here.

## Tasks

- [x] 1. RED: repository test proving `update` must send `$unset` for explicit `undefined` and `$set` for defined values
- [x] 2. GREEN: implement `$set`/`$unset` translation in `RemisionRepository.update`
- [x] 3. RED: use-case tests — type switch to `quantity_only` clears totals; `hasRetencion: false` clears `retencionValue`; `hasRetencion: true` with stored percentage recomputes; `hasRetencion: true` without any percentage throws 422
- [x] 4. GREEN: use case uses `dto.type ?? remision.type` and enforces the retention invariant
- [x] 5. Remove the `updateRemisionSchema` refine and align `remision.dto.test.ts`
- [x] 6. Document `documentType` and retención (fields and total formula) in README
- [x] 7. Verify: `bun test`, `tsc --noEmit`, `biome check .`
- [ ] 8. Work-unit commit (pending user authorization)

## Evidence

- **RED (observed before implementing)** — 6 failures across the 3 touched test files
  (41 pass / 6 fail): `updateRemisionSchema` rejected `{ hasRetencion: true }`; both
  repository `update` tests showed the raw patch reaching `findByIdAndUpdate`; the
  `quantity_only` switch kept `subtotal: 20`; the `priced` switch produced `undefined`
  totals; `hasRetencion: true` without a percentage raised `NotFoundError` instead of
  `ValidationError`.
- **GREEN** — `bun test`: 150 pass / 0 fail / 362 expect() calls, 22 files (was 140 pass).
- **Typecheck** — `bun run build` (`tsc --noEmit`): no diagnostics.
- **Lint** — `bunx biome check .`: 97 files, no fixes applied.
- **Independent verification** (gentle-ai-verify, read-only, did not trust the writer's
  report) — all five audit questions VERIFIED: the repository tests assert the real
  `$set`/`$unset` arguments and go RED under the old passthrough; `toHaveProperty` on an
  undefined value was proved to discriminate present-with-undefined from absent in bun
  1.4.2; both type tests go RED if `remision.type` is used again; the 422 guard is proven
  to fire before `repo.update`; no test asserts only the mocked return value.
  `src/domain/services/remisionTotals.ts` and its test are unmodified.
- **Non-issue checked** — an all-`undefined` patch would build an empty update document;
  Mongoose casts `{}` to `{}` (no-op) and the use case always sends a defined `type`, so
  it is unreachable. Behavior is identical to the pre-fix path.
- **Follow-up (out of scope)** — `ClientRepository.ts:53`, `CompanyRepository.ts:42`,
  `DriverRepository.ts:47` and `UserRepository.ts:40` share the same raw-passthrough
  shape. Their use cases pass the parsed Zod DTO directly, which never carries explicit
  `undefined`, so the defect is latent there rather than active. Optional hardening.
- **Commit** — pending user authorization (currently on `production`; branch first).
