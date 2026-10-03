// Co-located unit tests for computeRemisionTotals (pure domain math).
// Conventions: relative imports with .js extension; no mongoose, no
// process.env, no network/timers/filesystem; error paths asserted via
// instance checks on thrown values.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../shared/errors/AppError.js";
import { computeRemisionTotals } from "./remisionTotals.js";

describe("computeRemisionTotals", () => {
	test("sums quantity × unitPrice for priced items", () => {
		const totals = computeRemisionTotals(
			[
				{ description: "A", quantity: 2, unitPrice: 10, hasIva: false },
				{ description: "B", quantity: 3, unitPrice: 5.5, hasIva: false },
			],
			"priced",
		);

		expect(totals.subtotal).toBe(36.5);
		expect(totals.ivaValue).toBe(0);
		expect(totals.retencionValue).toBeUndefined();
		expect(totals.total).toBe(36.5);
	});

	test("returns 0 subtotal and 0 total for empty items", () => {
		const totals = computeRemisionTotals([], "priced");

		expect(totals.subtotal).toBe(0);
		expect(totals.ivaValue).toBe(0);
		expect(totals.retencionValue).toBeUndefined();
		expect(totals.total).toBe(0);
	});

	test("excludes items without unitPrice from monetary totals", () => {
		const totals = computeRemisionTotals(
			[
				{ description: "Priced", quantity: 2, unitPrice: 100, hasIva: false },
				{ description: "Count only", quantity: 5, hasIva: false },
			],
			"priced",
		);

		expect(totals.subtotal).toBe(200);
		expect(totals.total).toBe(200);
	});

	test("quantity_only type returns all undefined and does not enrich items", () => {
		const items = [
			{
				description: "Count only",
				quantity: 5,
				hasIva: true,
				ivaPercentage: 19,
			},
		];
		const totals = computeRemisionTotals(items, "quantity_only");

		expect(totals.subtotal).toBeUndefined();
		expect(totals.ivaValue).toBeUndefined();
		expect(totals.retencionValue).toBeUndefined();
		expect(totals.total).toBeUndefined();
		expect(totals.items).toEqual(items);
		expect(totals.items[0].ivaValue).toBeUndefined();
	});

	test("quantity_only strips a per-item ivaValue carried by the items", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "Count only",
					quantity: 5,
					hasIva: true,
					ivaPercentage: 19,
					ivaValue: 5,
				},
			],
			"quantity_only",
		);

		expect(totals.items[0]).not.toHaveProperty("ivaValue");
	});

	test("taxed item derives its own ivaValue", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 2,
					unitPrice: 100,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			"priced",
		);

		expect(totals.items[0].ivaValue).toBe(38);
		expect(totals.ivaValue).toBe(38);
		expect(totals.total).toBe(238);
	});

	test("exempt item produces no per-item ivaValue", () => {
		const totals = computeRemisionTotals(
			[{ description: "B", quantity: 2, unitPrice: 100, hasIva: false }],
			"priced",
		);

		expect(totals.items[0].ivaValue).toBeUndefined();
		expect(totals.ivaValue).toBe(0);
		expect(totals.total).toBe(200);
	});

	test("aggregate sums only taxed items (mixed taxed + exempt)", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 1,
					unitPrice: 100,
					hasIva: true,
					ivaPercentage: 19,
				},
				{ description: "B", quantity: 1, unitPrice: 100, hasIva: false },
			],
			"priced",
		);

		expect(totals.subtotal).toBe(200);
		expect(totals.items[0].ivaValue).toBe(19);
		expect(totals.items[1].ivaValue).toBeUndefined();
		expect(totals.ivaValue).toBe(19);
		expect(totals.total).toBe(219);
	});

	test("rounds per item first, then sums the rounded values", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 1,
					unitPrice: 0.19,
					hasIva: true,
					ivaPercentage: 19,
				},
				{
					description: "B",
					quantity: 1,
					unitPrice: 0.19,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			"priced",
		);

		expect(totals.items[0].ivaValue).toBe(0.04);
		expect(totals.items[1].ivaValue).toBe(0.04);
		expect(totals.ivaValue).toBe(0.08);
	});

	test("rounds to 2 decimals via toFixed(2)", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 1,
					unitPrice: 19.99,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			"priced",
		);

		expect(totals.subtotal).toBe(19.99);
		expect(totals.ivaValue).toBe(3.8);
		expect(totals.total).toBe(23.79);
	});

	test("throws ValidationError (422) on negative unitPrice", () => {
		let caught: unknown;

		try {
			computeRemisionTotals(
				[{ description: "A", quantity: 1, unitPrice: -5, hasIva: false }],
				"priced",
			);
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect((caught as ValidationError).statusCode).toBe(422);
	});

	test("throws ValidationError (422) when a priced item is missing hasIva", () => {
		let caught: unknown;

		try {
			computeRemisionTotals(
				[{ description: "A", quantity: 1, unitPrice: 10 }],
				"priced",
			);
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect((caught as ValidationError).statusCode).toBe(422);
	});

	test("throws ValidationError (422) when hasIva true lacks a positive ivaPercentage", () => {
		let caught: unknown;

		try {
			computeRemisionTotals(
				[{ description: "A", quantity: 1, unitPrice: 10, hasIva: true }],
				"priced",
			);
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect((caught as ValidationError).statusCode).toBe(422);
	});

	test("calculates retencionValue when hasRetencion is true", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 1,
					unitPrice: 1000,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			"priced",
			true,
			2.5,
		);

		expect(totals.subtotal).toBe(1000);
		expect(totals.ivaValue).toBe(190);
		expect(totals.retencionValue).toBe(25);
		// total = subtotal + iva - retencion = 1000 + 190 - 25 = 1165
		expect(totals.total).toBe(1165);
	});

	test("retencionValue is undefined when hasRetencion is false", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 1,
					unitPrice: 1000,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			"priced",
			false,
			2.5,
		);

		expect(totals.retencionValue).toBeUndefined();
		expect(totals.total).toBe(1190); // subtotal + iva, no retencion
	});

	test("retencionValue is undefined when retencionPercentage is not provided", () => {
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 1,
					unitPrice: 1000,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			"priced",
			true,
		);

		expect(totals.retencionValue).toBeUndefined();
		expect(totals.total).toBe(1190);
	});

	test("retencion with IVA composes correctly", () => {
		// subtotal=200, IVA 19%=38, retencion 2.5%=5
		// total = 200 + 38 - 5 = 233
		const totals = computeRemisionTotals(
			[
				{
					description: "A",
					quantity: 2,
					unitPrice: 50,
					hasIva: true,
					ivaPercentage: 19,
				},
				{
					description: "B",
					quantity: 1,
					unitPrice: 100,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			"priced",
			true,
			2.5,
		);

		expect(totals.subtotal).toBe(200);
		expect(totals.ivaValue).toBe(38);
		expect(totals.retencionValue).toBe(5);
		expect(totals.total).toBe(233);
	});
});
