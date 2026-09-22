// Co-located unit tests for remisionListQuerySchema.
// Conventions: bun:test, relative imports with .js extension, safeParse for
// negative cases (never expect().toThrow).
import { describe, expect, test } from "bun:test";
import { remisionListQuerySchema } from "./remision-list-query.dto.js";

describe("remisionListQuerySchema pagination", () => {
	test("coerces limit and page from strings", () => {
		const result = remisionListQuerySchema.safeParse({
			limit: "10",
			page: "2",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(10);
			expect(result.data.page).toBe(2);
		}
	});

	test("defaults limit to 20 and page to 1", () => {
		const result = remisionListQuerySchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(20);
			expect(result.data.page).toBe(1);
		}
	});

	test("rejects limit greater than 100", () => {
		expect(remisionListQuerySchema.safeParse({ limit: "101" }).success).toBe(
			false,
		);
	});

	test("rejects non-integer limit", () => {
		expect(remisionListQuerySchema.safeParse({ limit: "1.5" }).success).toBe(
			false,
		);
	});

	test("rejects non-integer page", () => {
		expect(remisionListQuerySchema.safeParse({ page: "2.5" }).success).toBe(
			false,
		);
	});
});

describe("remisionListQuerySchema name filters", () => {
	test("trims clientName and driverName", () => {
		const result = remisionListQuerySchema.safeParse({
			clientName: "  Acme  ",
			driverName: " Carlos ",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.clientName).toBe("Acme");
			expect(result.data.driverName).toBe("Carlos");
		}
	});

	test("whitespace-only clientName and driverName are absent", () => {
		const result = remisionListQuerySchema.safeParse({
			clientName: "   ",
			driverName: "\t ",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.clientName).toBeUndefined();
			expect(result.data.driverName).toBeUndefined();
		}
	});
});

describe("remisionListQuerySchema type filter", () => {
	test("accepts priced", () => {
		const result = remisionListQuerySchema.safeParse({ type: "priced" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.type).toBe("priced");
	});

	test("accepts quantity_only", () => {
		const result = remisionListQuerySchema.safeParse({
			type: "quantity_only",
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.type).toBe("quantity_only");
	});

	test("rejects an invalid type value", () => {
		expect(remisionListQuerySchema.safeParse({ type: "invalid" }).success).toBe(
			false,
		);
	});
});

describe("remisionListQuerySchema date range", () => {
	test("accepts ISO date-only from and to", () => {
		const result = remisionListQuerySchema.safeParse({
			from: "2026-01-01",
			to: "2026-01-31",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.from).toEqual(new Date("2026-01-01T00:00:00Z"));
			expect(result.data.to).toEqual(new Date("2026-01-31T23:59:59.999Z"));
		}
	});

	test("accepts an ISO datetime from", () => {
		const result = remisionListQuerySchema.safeParse({
			from: "2026-01-01T10:00:00Z",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.from).toEqual(new Date("2026-01-01T10:00:00Z"));
		}
	});

	test("rejects a non-ISO date", () => {
		expect(
			remisionListQuerySchema.safeParse({ from: "not-a-date" }).success,
		).toBe(false);
	});

	test("rejects an invalid calendar date", () => {
		expect(
			remisionListQuerySchema.safeParse({ to: "2026-13-99" }).success,
		).toBe(false);
	});

	test("rejects from after to", () => {
		const result = remisionListQuerySchema.safeParse({
			from: "2026-02-01",
			to: "2026-01-31",
		});
		expect(result.success).toBe(false);
	});
});

describe("remisionListQuerySchema boundary", () => {
	test("preserves companyId as a trimmed string", () => {
		const result = remisionListQuerySchema.safeParse({ companyId: " abc " });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.companyId).toBe("abc");
	});

	test("preserves search as a trimmed string", () => {
		const result = remisionListQuerySchema.safeParse({ search: " foo " });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.search).toBe("foo");
	});

	test("strips unknown query keys (no passthrough leak)", () => {
		const result = remisionListQuerySchema.safeParse({
			foo: "bar",
			baz: "qux",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).not.toHaveProperty("foo");
			expect(result.data).not.toHaveProperty("baz");
		}
	});
});
