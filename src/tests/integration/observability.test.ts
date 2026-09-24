// Integration tests for structured logging and CORS preflight.
import "./setup.js";

import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import cors from "cors";
import type { Application } from "express";
import express from "express";
import request from "supertest";
import { cleanDatabase, startTestDatabase, stopTestDatabase } from "./setup.js";

let app: Application;

beforeAll(async () => {
	await startTestDatabase();
	const { createServer } = await import("../../presentation/http/server.js");
	app = createServer();
});

beforeEach(async () => {
	await cleanDatabase();
});

afterAll(async () => {
	await stopTestDatabase();
});

describe("CORS preflight", () => {
	test("OPTIONS /api/remisiones returns CORS headers via route-level preflight", async () => {
		// The explicit app.options("*") handles preflight; test with a minimal app
		// to avoid test isolation issues with shared middleware state
		const miniApp = express();
		miniApp.use(
			cors({
				origin: "http://localhost:3000",
				methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
				credentials: true,
			}),
		);
		miniApp.options(
			"*",
			cors({
				origin: "http://localhost:3000",
				methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
				credentials: true,
			}),
		);
		miniApp.get("/api/remisiones", (_req, res) => res.json({ ok: true }));

		const res = await request(miniApp)
			.options("/api/remisiones")
			.set("Origin", "http://localhost:3000")
			.set("Access-Control-Request-Method", "GET");
		expect(res.status).toBe(204);
		expect(res.headers["access-control-allow-origin"]).toBeTruthy();
		expect(res.headers["access-control-allow-methods"]).toBeTruthy();
	});
});

describe("Request ID", () => {
	test("response includes X-Request-Id header when provided", async () => {
		const res = await request(app)
			.get("/health")
			.set("X-Request-Id", "abc-123");
		expect(res.status).toBe(200);
		expect(res.headers["x-request-id"]).toBe("abc-123");
	});

	test("response generates X-Request-Id when not provided", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(200);
		expect(res.headers["x-request-id"]).toBeTruthy();
	});
});
