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
import { swaggerUiHtml } from "./swagger-ui.js";

// The generated document is navigated by contract, not by the openapi3-ts
// types, so the assertions below use a loose structural shape.
type LooseSchema = {
	properties?: Record<string, unknown>;
	required?: string[];
};

type LooseOperation = {
	operationId?: string;
	security?: unknown;
	parameters?: Array<{ name?: string; in?: string }>;
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

// Collects every `$ref` value in the generated document so tests can prove a
// schema is emitted as a reference instead of an inline copy.
function collectRefs(node: unknown, refs = new Set<string>()): Set<string> {
	if (Array.isArray(node)) {
		for (const item of node) collectRefs(item, refs);
		return refs;
	}
	if (node && typeof node === "object") {
		for (const [key, value] of Object.entries(node)) {
			if (key === "$ref" && typeof value === "string") {
				refs.add(value);
			} else {
				collectRefs(value, refs);
			}
		}
	}
	return refs;
}

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

	test("exposes the full inventory: 16 path items and 30 operations", () => {
		const paths = document.paths ?? {};
		expect(Object.keys(paths)).toHaveLength(16);

		const operations = Object.entries(paths).flatMap(([path, item]) =>
			Object.entries(item ?? {}).map(([method, operation]) => ({
				path,
				method,
				operation,
			})),
		);
		expect(operations).toHaveLength(30);

		const operationIds = operations
			.map(({ operation }) => operation?.operationId)
			.filter((id): id is string => typeof id === "string");

		expect(operationIds).toHaveLength(30);
		expect([...operationIds].sort()).toEqual(
			[
				"getHealth",
				"createRemision",
				"listRemisiones",
				"getRemisionById",
				"updateRemision",
				"deleteRemision",
				"registerUser",
				"loginUser",
				"refreshToken",
				"logoutUser",
				"getCurrentUser",
				"listUsers",
				"getUserById",
				"updateUser",
				"deleteUser",
				"createCompany",
				"listCompanies",
				"getCompanyById",
				"updateCompany",
				"deleteCompany",
				"createClient",
				"listClients",
				"getClientById",
				"updateClient",
				"deleteClient",
				"createDriver",
				"listDrivers",
				"getDriverById",
				"updateDriver",
				"deleteDriver",
			].sort(),
		);
	});

	test("applies per-module security and documents 403 on the admin list", () => {
		const paths = document.paths ?? {};

		for (const publicPath of [
			"/api/auth/register",
			"/api/auth/login",
			"/api/auth/refresh",
		]) {
			expect(paths[publicPath]?.post?.security).toEqual([]);
		}

		const publicPaths = new Set([
			"/health",
			"/api/auth/register",
			"/api/auth/login",
			"/api/auth/refresh",
		]);

		for (const [path, item] of Object.entries(paths)) {
			if (publicPaths.has(path)) continue;
			for (const operation of Object.values(item ?? {})) {
				expect(operation?.security).toEqual([{ bearerAuth: [] }]);
			}
		}

		expect(paths["/api/users"]?.get?.responses).toHaveProperty("403");
	});

	test("loads the standalone preset before the bootstrap that references it", () => {
		const html = swaggerUiHtml();
		// The inline bootstrap references SwaggerUIStandalonePreset, which is a
		// separate UMD file. If its script tag is missing the page throws
		// "SwaggerUIStandalonePreset is not defined" and never renders.
		const presetScriptAt = html.indexOf("swagger-ui-standalone-preset.js");
		const bootstrapAt = html.indexOf("SwaggerUIStandalonePreset");

		expect(html).toContain("swagger-ui-bundle.js");
		expect(presetScriptAt).toBeGreaterThan(-1);
		expect(presetScriptAt).toBeLessThan(bootstrapAt);
	});

	test("documents the real list filters and the company duplicate conflict", () => {
		const paths = document.paths ?? {};
		const queryNames = (path: string) =>
			(paths[path]?.get?.parameters ?? [])
				.filter((p) => p.in === "query")
				.map((p) => p.name);

		expect(queryNames("/api/clients")).toEqual(
			expect.arrayContaining(["limit", "page", "companyId", "search"]),
		);
		expect(queryNames("/api/drivers")).toEqual(
			expect.arrayContaining(["limit", "page", "companyId", "search"]),
		);
		expect(queryNames("/api/companies")).toEqual(
			expect.arrayContaining(["limit", "page", "search"]),
		);
		expect(queryNames("/api/companies")).not.toContain("companyId");

		expect(
			Object.keys(paths["/api/companies/{id}"]?.patch?.responses ?? {}),
		).toContain("409");
	});

	test("documents pagination query parameters on the paginated list operations", () => {
		const paths = document.paths ?? {};
		for (const path of ["/api/companies", "/api/clients", "/api/drivers"]) {
			const names = (paths[path]?.get?.parameters ?? []).map((p) => p.name);
			expect(names).toContain("limit");
			expect(names).toContain("page");
		}
	});

	test("references each new response schema by $ref (not inlined)", () => {
		const refs = collectRefs(document);
		const schemaNames = [
			"User",
			"UserList",
			"Company",
			"CompanyList",
			"Client",
			"ClientList",
			"Driver",
			"DriverList",
		];
		for (const name of schemaNames) {
			expect(document.components?.schemas).toHaveProperty(name);
			expect(refs.has(`#/components/schemas/${name}`)).toBe(true);
		}
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
