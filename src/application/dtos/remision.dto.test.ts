// Co-located unit tests for remision DTO Zod schemas.
// Conventions: relative imports with .js extension; validation asserted via
// safeParse (never throw-expected for negative tests); no mongoose, no
// process.env, no network/timers/filesystem.
import { describe, expect, test } from "bun:test";
import { createRemisionSchema, updateRemisionSchema } from "@/application/dtos/remision.dto.js";

const companyId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const clientId = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("createRemisionSchema", () => {
	test("accepts valid priced creation", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: 2, unitPrice: 10 }],
			ivaPercentage: 19,
			notes: "nota",
		});

		expect(result.success).toBe(true);
	});

	test("accepts valid quantity_only creation", () => {
		const result = createRemisionSchema.safeParse({
			type: "quantity_only",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: 2 }],
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
			items: [{ description: "Item", quantity: 1 }],
		});

		expect(result.success).toBe(false);
	});

	test("rejects negative quantity", () => {
		const result = createRemisionSchema.safeParse({
			type: "quantity_only",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: -1 }],
		});

		expect(result.success).toBe(false);
	});

	test("rejects negative unitPrice", () => {
		const result = createRemisionSchema.safeParse({
			type: "priced",
			companyId,
			clientId,
			items: [{ description: "Item", quantity: 1, unitPrice: -5 }],
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
			items: [{ description: "Item", quantity: 1 }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes("items"))).toBe(
				true,
			);
		}
	});
});

describe("updateRemisionSchema", () => {
	test("accepts partial updates", () => {
		expect(
			updateRemisionSchema.safeParse({ notes: "actualizada" }).success,
		).toBe(true);
		expect(updateRemisionSchema.safeParse({ ivaPercentage: 19 }).success).toBe(
			true,
		);
		expect(
			updateRemisionSchema.safeParse({
				items: [{ description: "Item", quantity: 1, unitPrice: 5 }],
			}).success,
		).toBe(true);
	});
});
