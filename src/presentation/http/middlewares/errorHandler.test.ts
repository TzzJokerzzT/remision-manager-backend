// Integration tests for errorHandler middleware.
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
import express from "express";
import request from "supertest";
import {
	cleanDatabase,
	startTestDatabase,
	stopTestDatabase,
} from "../../../tests/integration/setup.js";

let app: Application;

beforeAll(async () => {
	await startTestDatabase();
	// Create a minimal app with just the error handler, not the full server
	app = express();

	const { NotFoundError } = await import("../../../shared/errors/AppError.js");
	const { errorHandler } = await import("./errorHandler.js");

	app.get("/test/app-error", () => {
		throw new NotFoundError("Test Resource");
	});
	app.get("/test/native-error", () => {
		throw new Error("Unexpected failure");
	});

	app.use(errorHandler);
});

beforeEach(async () => {
	await cleanDatabase();
});

afterAll(async () => {
	await stopTestDatabase();
});

describe("errorHandler middleware integration", () => {
	test("AppError (NotFoundError) returns 404 with structured response", async () => {
		const res = await request(app).get("/test/app-error");
		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
		expect(res.body.message).toContain("Test Resource");
	});

	test("native Error returns 500 with generic message", async () => {
		const res = await request(app).get("/test/native-error");
		expect(res.status).toBe(500);
		expect(res.body.success).toBe(false);
		expect(res.body.message).toBe("Error interno del servidor");
	});
});
