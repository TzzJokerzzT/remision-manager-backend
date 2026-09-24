// Integration tests for authorize middleware.
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

describe("authorize middleware integration", () => {
	test("user-role token accessing admin-only route returns 403", async () => {
		// Register first user (becomes admin)
		await request(app)
			.post("/api/auth/register")
			.send({
				name: "Admin User",
				email: "admin-authorize@example.com",
				password: "SecurePass123!",
			})
			.expect(201);

		// Register second user (becomes regular user)
		await request(app)
			.post("/api/auth/register")
			.send({
				name: "Regular User",
				email: "user-authorize@example.com",
				password: "SecurePass123!",
			})
			.expect(201);

		// Login as regular user
		const loginRes = await request(app)
			.post("/api/auth/login")
			.send({ email: "user-authorize@example.com", password: "SecurePass123!" })
			.expect(200);

		const { accessToken } = loginRes.body.data.tokens;

		// Access admin-only route (GET /api/users/ requires admin)
		const res = await request(app)
			.get("/api/users/")
			.set("Authorization", `Bearer ${accessToken}`);
		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	test("admin-role token accessing admin-only route returns 200", async () => {
		// Register first user (becomes admin)
		await request(app)
			.post("/api/auth/register")
			.send({
				name: "Admin User",
				email: "admin-authorize@example.com",
				password: "SecurePass123!",
			})
			.expect(201);

		// Login as admin
		const loginRes = await request(app)
			.post("/api/auth/login")
			.send({
				email: "admin-authorize@example.com",
				password: "SecurePass123!",
			})
			.expect(200);

		const { accessToken } = loginRes.body.data.tokens;

		// Access admin-only route
		const res = await request(app)
			.get("/api/users/")
			.set("Authorization", `Bearer ${accessToken}`);
		expect(res.status).toBe(200);
	});
});
