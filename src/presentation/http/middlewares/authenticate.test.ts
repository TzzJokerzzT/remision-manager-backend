// Integration tests for authenticate middleware.
// setup.ts must be the first import to bootstrap env before env.ts loads.
import "../../../tests/integration/setup.js";

import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import type { Application } from "express";
import request from "supertest";
import {
	cleanDatabase,
	startTestDatabase,
	stopTestDatabase,
} from "../../../tests/integration/setup.js";
import { generateAuthHeader } from "../../../tests/integration/helpers/auth.js";

let app: Application;

beforeAll(async () => {
	await startTestDatabase();
	const { createServer } = await import("../server.js");
	app = createServer();
});

beforeEach(async () => {
	await cleanDatabase();
});

afterAll(async () => {
	await stopTestDatabase();
});

describe("authenticate middleware integration", () => {
	test("missing Authorization header returns 401", async () => {
		const res = await request(app).get("/api/users/me");
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	test("invalid token returns 401", async () => {
		const res = await request(app)
			.get("/api/users/me")
			.set("Authorization", "Bearer invalid-token-here");
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	test("valid token for existing user returns 200", async () => {
		// Register a user first
		await request(app)
			.post("/api/auth/register")
			.send({
				name: "Test User",
				email: "auth-test@example.com",
				password: "SecurePass123!",
			})
			.expect(201);

		// Login to get tokens
		const loginRes = await request(app)
			.post("/api/auth/login")
			.send({ email: "auth-test@example.com", password: "SecurePass123!" })
			.expect(200);

		const { accessToken } = loginRes.body.data.tokens;

		// Access protected route
		const res = await request(app)
			.get("/api/users/me")
			.set("Authorization", `Bearer ${accessToken}`);
		expect(res.status).toBe(200);
		expect(res.body.data.email).toBe("auth-test@example.com");
	});
});
