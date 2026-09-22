// Co-located unit tests for computeRemisionTotals (pure domain math).
// Conventions: relative imports with .js extension; no mongoose, no
// process.env, no network/timers/filesystem; error paths asserted via
// instance checks on thrown values.
import { describe, expect, test } from "bun:test";
import { computeRemisionTotals } from "@/domain/services/remisionTotals.js";
import { ValidationError } from "@/shared/errors/AppError.js";

describe("computeRemisionTotals", () => {
	test("sums quantity × unitPrice for priced items", () => {
		const totals = computeRemisionTotals(
			[
				{ description: "A", quantity: 2, unitPrice: 10 },
				{ description: "B", quantity: 3, unitPrice: 5.5 },
			],
			"priced",
		);

		expect(totals.subtotal).toBe(36.5);
		expect(totals.ivaValue).toBe(0);
		expect(totals.total).toBe(36.5);
	});

	test("returns 0 subtotal and 0 total for empty items", () => {
		const totals = computeRemisionTotals([], "priced");

		expect(totals.subtotal).toBe(0);
		expect(totals.ivaValue).toBe(0);
		expect(totals.total).toBe(0);
	});

	test("excludes quantity_only items from monetary totals", () => {
		const totals = computeRemisionTotals(
			[
				{ description: "Priced", quantity: 2, unitPrice: 100 },
				{ description: "Count only", quantity: 5 },
			],
			"priced",
		);

		expect(totals.subtotal).toBe(200);
		expect(totals.total).toBe(200);
	});

	test("quantity_only type returns all undefined", () => {
		const totals = computeRemisionTotals(
			[{ description: "Count only", quantity: 5 }],
			"quantity_only",
		);

		expect(totals.subtotal).toBeUndefined();
		expect(totals.ivaValue).toBeUndefined();
		expect(totals.total).toBeUndefined();
	});

	test("rounds to 2 decimals via toFixed(2)", () => {
		const totals = computeRemisionTotals(
			[{ description: "A", quantity: 1, unitPrice: 19.99 }],
			"priced",
			19,
		);

		expect(totals.subtotal).toBe(19.99);
		expect(totals.ivaValue).toBe(3.8);
		expect(totals.total).toBe(23.79);
	});

	test("throws ValidationError (422) on negative unitPrice", () => {
		let caught: unknown;

		try {
			computeRemisionTotals(
				[{ description: "A", quantity: 1, unitPrice: -5 }],
				"priced",
			);
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect((caught as ValidationError).statusCode).toBe(422);
	});
});
