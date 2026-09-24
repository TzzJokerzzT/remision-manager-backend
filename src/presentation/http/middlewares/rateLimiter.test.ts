// Integration tests for rateLimiter middleware.
import "../../../tests/integration/setup.js";

import { describe, expect, test } from "bun:test";
import express from "express";
import request from "supertest";
import { createGeneralLimiter } from "./rateLimiter.js";

function createTestApp() {
	const app = express();
	app.use(createGeneralLimiter(1000, 2)); // 2 requests per second
	app.get("/test", (_req, res) => res.json({ ok: true }));
	return app;
}

describe("rateLimiter middleware integration", () => {
	test("allows requests within the limit", async () => {
		const app = createTestApp();
		const res1 = await request(app).get("/test");
		expect(res1.status).toBe(200);

		const res2 = await request(app).get("/test");
		expect(res2.status).toBe(200);
	});

	test("blocks requests over the limit with 429", async () => {
		const app = createTestApp();
		await request(app).get("/test");
		await request(app).get("/test");
		const res3 = await request(app).get("/test");
		expect(res3.status).toBe(429);
		expect(res3.body.success).toBe(false);
	});
});
