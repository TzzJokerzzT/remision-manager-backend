// Co-located unit tests for the pagination query schema and response builder.
// Conventions: relative imports with .js extension; validation asserted via
// safeParse (never throw-expected for negative tests); no mongoose, no
// process.env, no network/timers/filesystem.
import { describe, expect, test } from "bun:test";
import {
	buildPaginationResponse,
	paginationQuerySchema,
} from "@/application/dtos/pagination.dto.js";

describe("paginationQuerySchema", () => {
	test("coerces string limit and page to numbers", () => {
		const result = paginationQuerySchema.safeParse({ limit: "10", page: "2" });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(10);
			expect(result.data.page).toBe(2);
		}
	});

	test("defaults limit to 20 and page to 1 when absent", () => {
		const result = paginationQuerySchema.safeParse({});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(20);
			expect(result.data.page).toBe(1);
		}
	});

	test("rejects non-numeric limit", () => {
		expect(paginationQuerySchema.safeParse({ limit: "abc" }).success).toBe(
			false,
		);
	});

	test("rejects non-numeric page", () => {
		expect(paginationQuerySchema.safeParse({ page: "xyz" }).success).toBe(
			false,
		);
	});

	test("rejects negative limit", () => {
		expect(paginationQuerySchema.safeParse({ limit: "-5" }).success).toBe(
			false,
		);
	});

	test("rejects negative page", () => {
		expect(paginationQuerySchema.safeParse({ page: "-1" }).success).toBe(false);
	});

	test("rejects zero limit", () => {
		expect(paginationQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
	});

	test("rejects zero page", () => {
		expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
	});

	test("rejects non-integer limit", () => {
		expect(paginationQuerySchema.safeParse({ limit: 10.5 }).success).toBe(
			false,
		);
	});

	test("rejects non-integer page", () => {
		expect(paginationQuerySchema.safeParse({ page: 2.5 }).success).toBe(false);
	});

	test("rejects limit above the maximum of 100", () => {
		expect(paginationQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
	});

	test("passthrough preserves search and companyId keys", () => {
		const result = paginationQuerySchema.safeParse({
			limit: "10",
			search: "foo",
			companyId: "abc123",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(10);
			expect(result.data.search).toBe("foo");
			expect(result.data.companyId).toBe("abc123");
		}
	});
});

describe("buildPaginationResponse", () => {
	test("exact division yields integer totalPages", () => {
		const response = buildPaginationResponse<string>([], 40, 20, 1);

		expect(response.totalPages).toBe(2);
	});

	test("remainder rounds up to the next page", () => {
		const response = buildPaginationResponse<string>([], 45, 20, 1);

		expect(response.totalPages).toBe(3);
	});

	test("zero total yields zero pages", () => {
		const response = buildPaginationResponse<string>([], 0, 20, 1);

		expect(response.totalPages).toBe(0);
	});

	test("limit greater than total yields a single page", () => {
		const response = buildPaginationResponse<string>([], 5, 20, 1);

		expect(response.totalPages).toBe(1);
	});

	test("returns the full DTO shape", () => {
		const items = ["a", "b"];
		const response = buildPaginationResponse(items, 20, 20, 1);

		expect(response).toEqual({
			items,
			total: 20,
			limit: 20,
			page: 1,
			totalPages: 1,
		});
	});
});
