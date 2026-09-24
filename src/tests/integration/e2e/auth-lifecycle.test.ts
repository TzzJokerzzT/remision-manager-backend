// E2E auth lifecycle integration test.
// Exercises the full request lifecycle: register → login → authenticated request.
import "../setup.js";

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
} from "../setup.js";

let app: Application;

beforeAll(async () => {
	await startTestDatabase();
	const { createServer } = await import("../../../presentation/http/server.js");
	app = createServer();
});

beforeEach(async () => {
	await cleanDatabase();
});

afterAll(async () => {
	await stopTestDatabase();
});

describe("Auth lifecycle E2E", () => {
	test("register → login → authenticated GET /api/users/me", async () => {
		// 1. Register
		const registerRes = await request(app).post("/api/auth/register").send({
			name: "E2E User",
			email: "e2e@example.com",
			password: "SecurePass123!",
		});
		expect(registerRes.status).toBe(201);
		expect(registerRes.body.data.user.email).toBe("e2e@example.com");

		// 2. Login
		const loginRes = await request(app)
			.post("/api/auth/login")
			.send({ email: "e2e@example.com", password: "SecurePass123!" });
		expect(loginRes.status).toBe(200);
		const { accessToken } = loginRes.body.data.tokens;
		expect(accessToken).toBeTruthy();

		// 3. Authenticated request
		const meRes = await request(app)
			.get("/api/users/me")
			.set("Authorization", `Bearer ${accessToken}`);
		expect(meRes.status).toBe(200);
		expect(meRes.body.data.email).toBe("e2e@example.com");
		expect(meRes.body.data.name).toBe("E2E User");
	});

	test("authenticated request without token returns 401", async () => {
		// Register and login
		await request(app).post("/api/auth/register").send({
			name: "No Token User",
			email: "notoken@example.com",
			password: "SecurePass123!",
		});

		await request(app)
			.post("/api/auth/login")
			.send({ email: "notoken@example.com", password: "SecurePass123!" });

		// Access without token
		const res = await request(app).get("/api/users/me");
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});
});
