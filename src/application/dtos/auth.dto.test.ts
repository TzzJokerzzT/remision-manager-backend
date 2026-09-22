// Co-located unit tests for auth DTO Zod schemas.
// Conventions: relative imports with .js extension; validation asserted via
// safeParse (never throw-expected for negative tests); no mongoose, no
// process.env, no network/timers/filesystem.
import { describe, expect, test } from "bun:test";
import { loginSchema, refreshSchema, registerSchema } from "./auth.dto.js";

describe("auth DTO schemas", () => {
	test("registerSchema accepts valid registration", () => {
		const result = registerSchema.safeParse({
			name: "Alex Buelvas",
			email: "alex@example.com",
			password: "Password1",
		});

		expect(result.success).toBe(true);
	});

	test("registerSchema rejects invalid email", () => {
		const result = registerSchema.safeParse({
			name: "Alex Buelvas",
			email: "not-an-email",
			password: "Password1",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes("email"))).toBe(
				true,
			);
		}
	});

	test("registerSchema rejects weak passwords", () => {
		const base = {
			name: "Alex Buelvas",
			email: "alex@example.com",
		};

		// too short (< 8)
		expect(registerSchema.safeParse({ ...base, password: "Ab1" }).success).toBe(
			false,
		);
		// missing uppercase
		expect(
			registerSchema.safeParse({ ...base, password: "password1" }).success,
		).toBe(false);
		// missing lowercase
		expect(
			registerSchema.safeParse({ ...base, password: "PASSWORD1" }).success,
		).toBe(false);
		// missing digit
		expect(
			registerSchema.safeParse({ ...base, password: "Password" }).success,
		).toBe(false);
	});

	test("loginSchema accepts valid credentials", () => {
		const result = loginSchema.safeParse({
			email: "alex@example.com",
			password: "secret",
		});

		expect(result.success).toBe(true);
	});

	test("refreshSchema rejects short refreshToken", () => {
		const result = refreshSchema.safeParse({ refreshToken: "short" });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some((i) => i.path.includes("refreshToken")),
			).toBe(true);
		}
	});
});
