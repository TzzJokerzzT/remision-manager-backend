# Feature: remision per-item IVA

**Status**: implemented, verified, nuances resolved — awaiting commit authorization
**Origin**: new requirement — each product must carry its own IVA, because some products are IVA-exempt
**Branch**: `feat/remision-per-item-iva`, stacked on `feat/remision-retention-consistency` (PR #5)

## Problem

Today IVA is **remisión-level only**: one `ivaPercentage` for the whole document and
`ivaValue = subtotal × ivaPercentage / 100`, computed over the entire subtotal
(`src/domain/services/remisionTotals.ts`). Items are just
`{ description, quantity, unitPrice? }` (`Remision.model.ts:34-40`).

With IVA-exempt products that formula is wrong by construction:

```
Item A (taxed)   1 × $100  → base 100
Item B (exempt)  1 × $100  → base 100
subtotal = 200

before:  ivaValue = 200 × 19% = 38   ← charges IVA on the exempt item
after:   ivaValue = 100 × 19% = 19   ← only on A
```

## Locked contract

Decisions taken with the user before implementation:

| # | Decision | Choice |
|---|----------|--------|
| 1 | What happens to the remisión-level `ivaPercentage` | **Replace**: IVA is per item only; `ivaPercentage` disappears from body and model |
| 2 | Per-item data | **Rate**: each item carries its own `ivaPercentage`; the backend derives the amount |
| 3 | The aggregate `ivaValue` the front sends | **Validate**: the backend derives the sum and rejects with 422 when the sent value does not match |
| 4 | Existing documents and clients | **Clean break, no migration**: every new POST/PATCH requires per-item IVA |

### Item shape (new)

```ts
interface RemisionItem {
  description: string;
  quantity: number;
  unitPrice?: number;
  hasIva?: boolean;        // explicit exemption marker; REQUIRED in the input DTO
  ivaPercentage?: number;  // the rate for this item
  ivaValue?: number;       // DERIVED by the backend and stored per item
}
```

- `hasIva` is **required in the DTO** on every item; it stays **optional in the entity and
  Mongoose model**, because historical documents genuinely lack it.
- `hasIva: true` ⇒ `ivaPercentage` required and `> 0`.
- `hasIva: false` ⇒ `ivaPercentage` absent or `0`; a positive rate is a contradiction → 422.
- Per-item `ivaValue` is **never accepted from the client**; it is derived and persisted.

### Remisión level

- `ivaPercentage` is **removed** from the entity, the Mongoose schema and both DTOs.
- `ivaValue` is always **derived** server-side; accepted from the client as an **optional
  cross-check** (mismatch on a `priced` remisión → 422).
- `total = subtotal + ivaValue − retencionValue`; retención stays on the **subtotal**.
- `type: "quantity_only"` has no prices: per-item IVA is ignored and no totals are produced.

### Rounding rule

- Per item: `round2(quantity × unitPrice × ivaPercentage / 100)`
- Aggregate: `round2(Σ per-item ivaValue)` over already-rounded per-item values

### Named edge case — historical documents

A `PATCH` that does not resend `items` on a `priced` remisión whose stored items have no
`hasIva` would recompute `ivaValue` as `0` and silently corrupt the document. The
calculation **rejects with 422**, telling the client to resend `items` with per-item IVA.
Accepted consequence of the clean break: historical priced documents cannot be updated
until their items are resent.

## Nuances from independent verification (both RESOLVED)

**N1 — a failed `create` consumed a consecutive number.** `getNextConsecutive` ran before
the totals calculation and the aggregate cross-check, so any rejected create burned a
consecutive. Pre-existing ordering, but this feature added one more failure path after the
increment. **Fixed**: the allocation moved after every validation, with a comment stating
why. RED first — `getNextConsecutive` was called once on a rejected create; GREEN — it is
never called.

**N2 — `quantity_only` items passed through unenriched.** A caller bypassing the Zod route
layer could persist a per-item `ivaValue`, a derived field that `quantity_only` must not
carry. **Fixed**: the `quantity_only` branch strips the per-item `ivaValue` while keeping
`hasIva`/`ivaPercentage`, so a later switch to `priced` can reuse the rates. RED first — the
key survived on the returned items; GREEN — `not.toHaveProperty("ivaValue")` passes.

## Non-goals

- No migration script and no backfill (decision 4).
- No change to the retention calculation or to the `total` formula.
- No `documentType` filter in the listing.
- No per-item retention.

## Tasks

- [x] 1. RED: domain service tests — per-item IVA (taxed + exempt), aggregate sum, rounding, `quantity_only`, and the missing-`hasIva` guard
- [x] 2. GREEN: `computeRemisionTotals` derives per-item IVA and the aggregate; the remisión-level `ivaPercentage` parameter is removed
- [x] 3. RED: DTO tests — `hasIva`/`ivaPercentage` per item, both contradiction refinements, `ivaPercentage` gone at remisión level, optional aggregate `ivaValue`
- [x] 4. GREEN: DTOs (`createRemisionSchema`, `updateRemisionSchema`)
- [x] 5. RED: use-case tests — derived per-item values persisted into `items`, aggregate derived, sent-vs-derived mismatch → 422
- [x] 6. GREEN: use case `create`/`update`
- [x] 7. Entity, Mongoose item sub-schema, repository `toDomain` mapping; drop the remisión-level `ivaPercentage`
- [x] 8. Update the 4 test fixtures (`makeRemision`, `makeDoc`, item arrays) so the suite compiles
- [x] 9. README: per-item IVA, the new item shape, the formula, the rounding rule and the breaking change
- [x] 10. Verify: `bun test`, `bun run typecheck`, `bunx biome check .`
- [x] 11. Resolve N1 and N2: consecutive allocated after validation; `quantity_only` strips the per-item `ivaValue`
- [ ] 12. Work-unit commit + native review (pending user authorization)

## Evidence

- **RED** (observed before implementing) — 143 pass / 26 fail / 378 expects across 169 tests.
  The 26 failures were the new contract tests plus every pre-existing test whose fixture
  encoded the old shape. Representative assertion: `expect(payload.total).toBe(23.3)` →
  `Received: 19.5`, because the old code zeroed IVA once the remisión-level `ivaPercentage`
  was removed from the fixture.
- **GREEN** — `bun test`: **171 pass / 0 fail / 415 expect() calls**, 22 files (was 150 at
the start of this feature, 169 after the main implementation, 171 after N1/N2).
- **Typecheck** — `bun run typecheck` (`tsc --noEmit`): clean.
- **Lint** — `bunx biome check .`: 97 files, no fixes applied.
- **Independent verification** (gentle-ai-verify, read-only, did not trust the writer report)
  — 7/7 audit questions VERIFIED:
  - the rounding test genuinely discriminates per-item-then-sum from aggregate-then-round
    (`0.04 + 0.04 = 0.08` versus `round2(0.0722) = 0.07`);
  - the missing-`hasIva` guard throws 422 before any repository call, so a historical
    priced document cannot be silently rewritten with `ivaValue: 0`;
  - the aggregate cross-check precedes persistence in both `create` and `update`, is gated
    on `priced`, and writes nothing when it throws;
  - the enriched items and the derived `ivaValue` are placed after `...dto`, so no client
    value can overwrite them, and exempt items strip any prior per-item `ivaValue`;
  - a client-sent remisión `ivaPercentage` and per-item `ivaValue` are dropped by Zod, and
    the stored remisión `ivaValue` is always the derived one, including `quantity_only`;
  - no pre-existing assertion was weakened or deleted — the retention numbers are unchanged
    (190/25/1165, 1190, 1190, 38/5/233) and the `RemisionUseCases.update` describe block has
    zero diff lines;
  - no float-equality trap: `round2` always yields the 2-decimal double, so a correct
    2-decimal client value never trips the strict `!==`.
- **Non-issue checked** — an all-`undefined` patch builds an empty update document; Mongoose
  casts `{}` to `{}` (no-op) and the use case always sends a defined `type`.

## Review size note

The field removal is compile-time-wide: `ivaPercentage` is referenced in 7 source files, 4
test files and the README, so this is a single atomic work unit — there is no cohesive split
where an intermediate state compiles and behaves. This is a `size:exception` case, not a
slicing failure.
