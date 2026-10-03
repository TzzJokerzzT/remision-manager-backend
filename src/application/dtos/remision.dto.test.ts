// Co-located unit tests for remision DTO Zod schemas.
// Conventions: relative imports with .js extension; validation asserted via
// safeParse (never throw-expected for negative tests); no mongoose, no
// process.env, no network/timers/filesystem.
import { describe, expect, test } from "bun:test";
import { createRemisionSchema, updateRemisionSchema } from "./remision.dto.js";

const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const clientId = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("createRemisionSchema", () => {
	test("accepts valid priced creation", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{
					description: "Item",
					quantity: 2,
					unitPrice: 10,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			ivaValue: 3.8,
			notes: "nota",
		});

		expect(result.success).toBe(true);
	});

	test("accepts valid quantity_only creation", () => {
		const result = createRemisionSchema.safeParse({
			type: "quantity_only",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: 2, hasIva: false }],
		});

		expect(result.success).toBe(true);
	});

	test("rejects missing required fields", () => {
		const result = createRemisionSchema.safeParse({ type: "quantity_only" });

		expect(result.success).toBe(false);
		if (!result.success) {
			const paths = result.error.issues.map((i) => i.path.join("."));
			expect(paths).toContain("companyId");
			expect(paths).toContain("clientId");
			expect(paths).toContain("items");
		}
	});

	test("rejects non-hex 24-char ids", () => {
		const result = createRemisionSchema.safeParse({
			type: "quantity_only",
			companyId: "zzzzzzzzzzzzzzzzzzzzzzzz",
			clientId,
			items: [{ description: "Item", quantity: 1, hasIva: false }],
		});

		expect(result.success).toBe(false);
	});

	test("rejects negative quantity", () => {
		const result = createRemisionSchema.safeParse({
			type: "quantity_only",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: -1, hasIva: false }],
		});

		expect(result.success).toBe(false);
	});

	test("rejects negative unitPrice", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{ description: "Item", quantity: 1, unitPrice: -5, hasIva: false },
			],
		});

		expect(result.success).toBe(false);
	});

	test("rejects empty items array", () => {
		const result = createRemisionSchema.safeParse({
			type: "quantity_only",
			companyId,
			clientId,
			items: [],
		});

		expect(result.success).toBe(false);
	});

	test("rejects priced item missing unitPrice", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: 1, hasIva: false }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes("items"))).toBe(
				true,
			);
		}
	});

	test("rejects hasRetencion true without retencionPercentage", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{ description: "Item", quantity: 1, unitPrice: 10, hasIva: false },
			],
			hasRetencion: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some((i) => i.path.includes("retencionPercentage")),
			).toBe(true);
		}
	});

	test("rejects item missing hasIva", () => {
		const result = createRemisionSchema.safeParse({
			type: "quantity_only",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: 1 }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some((i) => i.path.join(".") === "items.0.hasIva"),
			).toBe(true);
		}
	});

	test("rejects hasIva true without ivaPercentage", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{ description: "Item", quantity: 1, unitPrice: 10, hasIva: true },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some(
					(i) => i.path.join(".") === "items.0.ivaPercentage",
				),
			).toBe(true);
		}
	});

	test("rejects hasIva true with ivaPercentage 0", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{
					description: "Item",
					quantity: 1,
					unitPrice: 10,
					hasIva: true,
					ivaPercentage: 0,
				},
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some(
					(i) => i.path.join(".") === "items.0.ivaPercentage",
				),
			).toBe(true);
		}
	});

	test("rejects hasIva false with a positive ivaPercentage", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{
					description: "Item",
					quantity: 1,
					unitPrice: 10,
					hasIva: false,
					ivaPercentage: 19,
				},
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some(
					(i) => i.path.join(".") === "items.0.ivaPercentage",
				),
			).toBe(true);
		}
	});

	test("accepts hasIva false without ivaPercentage", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{ description: "Item", quantity: 1, unitPrice: 10, hasIva: false },
			],
		});

		expect(result.success).toBe(true);
	});

	test("remisión-level ivaPercentage is no longer accepted", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{
					description: "Item",
					quantity: 1,
					unitPrice: 10,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			ivaPercentage: 19,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).not.toHaveProperty("ivaPercentage");
		}
	});

	test("accepts optional remisión-level ivaValue", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{
					description: "Item",
					quantity: 1,
					unitPrice: 10,
					hasIva: true,
					ivaPercentage: 19,
				},
			],
			ivaValue: 1.9,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ivaValue).toBe(1.9);
		}
	});

	test("item-level ivaValue is not accepted (derived server-side)", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [
				{
					description: "Item",
					quantity: 1,
					unitPrice: 10,
					hasIva: true,
					ivaPercentage: 19,
					ivaValue: 1.9,
				},
			],
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.items[0]).not.toHaveProperty("ivaValue");
		}
	});
});

describe("updateRemisionSchema", () => {
	test("accepts partial updates", () => {
		expect(
			updateRemisionSchema.safeParse({ notes: "actualizada" }).success,
		).toBe(true);
		expect(updateRemisionSchema.safeParse({ ivaValue: 19 }).success).toBe(true);
		expect(
			updateRemisionSchema.safeParse({
				items: [
					{
						description: "Item",
						quantity: 1,
						unitPrice: 5,
						hasIva: true,
						ivaPercentage: 19,
					},
				],
			}).success,
		).toBe(true);
	});

	test("accepts hasRetencion true without retencionPercentage", () => {
		expect(updateRemisionSchema.safeParse({ hasRetencion: true }).success).toBe(
			true,
		);
	});

	test("rejects item IVA contradictions in partial items", () => {
		const result = updateRemisionSchema.safeParse({
			items: [{ description: "Item", quantity: 1, unitPrice: 5, hasIva: true }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some(
					(i) => i.path.join(".") === "items.0.ivaPercentage",
				),
			).toBe(true);
		}
	});

	test("remisión-level ivaPercentage is no longer accepted", () => {
		const result = updateRemisionSchema.safeParse({ ivaPercentage: 19 });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).not.toHaveProperty("ivaPercentage");
		}
	});
});
