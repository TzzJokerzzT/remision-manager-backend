// Co-located unit tests for the escapeRegex helper.
// Conventions: bun:test, relative imports with .js extension, no
// process.env/network/timers/filesystem.
import { describe, expect, test } from "bun:test";
import { escapeRegex } from "./escape-regex.js";

describe("escapeRegex", () => {
	test("escapes each regex metacharacter to a literal", () => {
		const metacharacters = [
			".",
			"*",
			"+",
			"?",
			"^",
			"$",
			"{",
			"}",
			"(",
			")",
			"|",
			"[",
			"]",
			"\\",
		];
		for (const ch of metacharacters) {
			expect(escapeRegex(ch)).toBe(`\\${ch}`);
		}
	});

	test("escapes metacharacters embedded in a word", () => {
		expect(escapeRegex("a.b")).toBe("a\\.b");
		expect(escapeRegex("a+b")).toBe("a\\+b");
	});

	test("returns a plain string unchanged", () => {
		expect(escapeRegex("acme corp")).toBe("acme corp");
	});

	test("returns empty string for empty input", () => {
		expect(escapeRegex("")).toBe("");
	});
});
