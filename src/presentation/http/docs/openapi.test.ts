// Co-located tests for the OpenAPI document and the docs serving.
// Conventions: bun:test + vi.mock of the env module; no real DB, no network,
// no process.env mutation, no timers; relative imports with .js extension.
import { describe, expect, test, vi } from "bun:test";

vi.mock("../../../config/env.js", () => ({
	env: {
		NODE_ENV: "test",
		PORT: 0,
		MONGO_URI: "mongodb://localhost:27017/test",
		JWT_ACCESS_SECRET: "test-access-secret-min-32-chars-ok!",
		JWT_REFRESH_SECRET: "test-refresh-secret-min-32-chars-ok!",
		JWT_ACCESS_EXPIRES_IN: "15m",
		JWT_REFRESH_EXPIRES_IN: "7d",
		CORS_ORIGINS: "http://localhost:3000",
		CORS_ORIGINS_LIST: ["http://localhost:3000"],
		RATE_LIMIT_WINDOW_MS: 900000,
		RATE_LIMIT_MAX: 300,
		LOG_LEVEL: "info",
		ENABLE_API_DOCS: true,
	},
}));

import request from "supertest";
import { env } from "../../../config/env.js";
import { createServer } from "../server.js";
import { buildOpenApiDocument } from "./openapi.js";

// The generated document is navigated by contract, not by the openapi3-ts
// types, so the assertions below use a loose structural shape.
type LooseSchema = {
	properties?: Record<string, unknown>;
	required?: string[];
};

type LooseOperation = {
	security?: unknown;
	requestBody?: {
		content?: Record<string, { schema?: unknown; example?: unknown }>;
	};
	responses?: Record<
		string,
		{ content?: Record<string, { schema?: unknown; example?: unknown }> }
	>;
};

type LooseDocument = {
	openapi?: string;
	components?: {
		schemas?: Record<string, LooseSchema>;
		securitySchemes?: Record<string, unknown>;
	};
	paths?: Record<string, Record<string, LooseOperation | undefined>>;
};

const document = buildOpenApiDocument() as unknown as LooseDocument;

describe("OpenAPI document", () => {
	test("is OpenAPI 3.0.3 and declares the bearerAuth scheme", () => {
		expect(document.openapi).toBe("3.0.3");
		expect(document.components?.securitySchemes?.bearerAuth).toEqual({
			type: "http",
			scheme: "bearer",
			bearerFormat: "JWT",
		});
	});

	test("includes /health and the five remisiones operations", () => {
		const paths = document.paths ?? {};
		expect(paths).toHaveProperty("/health");
		expect(paths).toHaveProperty("/api/remisiones");
		expect(paths).toHaveProperty("/api/remisiones/{id}");

		expect(paths["/api/remisiones"]).toHaveProperty("post");
		expect(paths["/api/remisiones"]).toHaveProperty("get");

		expect(paths["/api/remisiones/{id}"]).toHaveProperty("get");
		expect(paths["/api/remisiones/{id}"]).toHaveProperty("patch");
		expect(paths["/api/remisiones/{id}"]).toHaveProperty("delete");
	});

	test("applies bearer security to remisiones and none to /health", () => {
		const paths = document.paths ?? {};
		expect(paths["/health"]?.get?.security).toEqual([]);

		for (const [path, item] of Object.entries(paths)) {
			if (!path.startsWith("/api/remisiones")) continue;
			for (const operation of Object.values(item ?? {})) {
				expect(operation?.security).toEqual([{ bearerAuth: [] }]);
			}
		}
	});

	test("exposes the per-item IVA contract in the RemisionItem schema", () => {
		const item = document.components?.schemas?.RemisionItem;
		expect(item?.properties).toHaveProperty("hasIva");
		expect(item?.properties).toHaveProperty("ivaPercentage");
		expect(item?.properties).toHaveProperty("ivaValue");
	});

	test("documents the request and response examples with the documented numbers", () => {
		const post = document.paths?.["/api/remisiones"]?.post;

		const requestExample = post?.requestBody?.content?.["application/json"]
			?.example as
			| {
					items?: Array<{
						quantity: number;
						unitPrice?: number;
						hasIva: boolean;
						ivaPercentage?: number;
					}>;
					ivaValue?: number;
			  }
			| undefined;

		expect(requestExample?.items?.length).toBe(2);
		const taxed = requestExample?.items?.find((i) => i.hasIva);
		const exempt = requestExample?.items?.find((i) => !i.hasIva);
		expect(taxed?.quantity).toBe(1);
		expect(taxed?.unitPrice).toBe(100);
		expect(taxed?.ivaPercentage).toBe(19);
		expect(exempt?.quantity).toBe(1);
		expect(exempt?.unitPrice).toBe(100);
		// Two items of 100 ⇒ subtotal 200; the optional aggregate cross-check
		// documents the derived IVA it must match.
		expect(requestExample?.ivaValue).toBe(19);

		const responseExample = post?.responses?.["201"]?.content?.[
			"application/json"
		]?.example as
			| {
					data?: {
						subtotal?: number;
						ivaValue?: number;
						total?: number;
					};
			  }
			| undefined;

		expect(responseExample?.data?.subtotal).toBe(200);
		expect(responseExample?.data?.ivaValue).toBe(19);
		expect(responseExample?.data?.total).toBe(219);
	});

	test("documents the optional details field in the error envelope", () => {
		const errorEnvelope = document.components?.schemas?.ErrorEnvelope;
		expect(errorEnvelope?.properties).toHaveProperty("details");
		expect(errorEnvelope?.required).not.toContain("details");
	});
});

describe("docs gating", () => {
	test("serves both docs routes when ENABLE_API_DOCS is true", async () => {
		env.ENABLE_API_DOCS = true;
		const app = createServer();

		const ui = await request(app).get("/api-docs");
		expect(ui.status).toBe(200);
		expect(ui.text).toContain("SwaggerUIBundle");

		const spec = await request(app).get("/api-docs/openapi.json");
		expect(spec.status).toBe(200);
		expect(spec.body.openapi).toBe("3.0.3");
	});

	test("returns 404 for both docs routes when ENABLE_API_DOCS is false", async () => {
		env.ENABLE_API_DOCS = false;
		const app = createServer();

		await request(app).get("/api-docs").expect(404);
		await request(app).get("/api-docs/openapi.json").expect(404);
	});
});
