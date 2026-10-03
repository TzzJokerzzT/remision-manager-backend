import {
	OpenAPIRegistry,
	OpenApiGeneratorV3,
	type ResponseConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
	createRemisionSchema,
	updateRemisionSchema,
} from "../../../application/dtos/remision.dto.js";
import { remisionListQuerySchema } from "../../../application/dtos/remision-list-query.dto.js";
import { mongoIdSchema } from "../../../application/dtos/user.dto.js";
import {
	errorEnvelopeSchema,
	remisionItemSchema,
	remisionListSchema,
	remisionSchema,
	successEnvelopeSchema,
} from "./schemas.js";

// OpenAPI cannot express conditional cross-field rules, so these refinements
// are documented as prose in the operation descriptions instead.
const remisionIvaContract = [
	"- `hasIva` es requerido en cada item de la petición (`true` si grava IVA, `false` si es exento).",
	"- `ivaPercentage` es requerido y mayor a `0` cuando `hasIva` es `true`; debe estar ausente o ser `0` cuando `hasIva` es `false` (contradicción validada en el DTO, no expresable en OpenAPI).",
	"- El `ivaValue` de cada item es derivado por el servidor y nunca se acepta desde el cliente.",
	"- Redondeo: por item `round2(quantity × unitPrice × ivaPercentage / 100)`; el agregado es `round2(Σ ivaValue por item)` sobre los valores ya redondeados.",
	"- El `ivaValue` agregado se acepta como verificación opcional: en una remisión `priced`, si se envía y no coincide con el valor calculado, se rechaza con `422`.",
	"- Regla `priced` ⇒ `unitPrice`: cada item debe incluir `unitPrice` cuando `type` es `priced` (validado en el DTO, no expresable en OpenAPI).",
	"- Retención: `retencionPercentage` es requerido cuando `hasRetencion` es `true`; la retención se aplica sobre el subtotal (`total = subtotal + ivaValue − retencionValue`).",
].join("\n");

const patchHistoricalNote =
	"\n- Un `PATCH` que no reenvía `items` sobre una remisión `priced` cuyos items almacenados no tienen `hasIva` se rechaza con `422` (reenvíe `items` con IVA por item).";

const remisionDataExample = {
	id: "6a399e6253da3bf3c3021052",
	consecutive: 1,
	type: "priced",
	documentType: "remision",
	companyId: "6a399e6253da3bf3c3021049",
	clientId: "6a399e6253da3bf3c3021050",
	driverId: "6a399e6253da3bf3c3021051",
	items: [
		{
			description: "Producto gravado",
			quantity: 1,
			unitPrice: 100,
			hasIva: true,
			ivaPercentage: 19,
			ivaValue: 19,
		},
		{
			description: "Producto exento",
			quantity: 1,
			unitPrice: 100,
			hasIva: false,
		},
	],
	subtotal: 200,
	ivaValue: 19,
	hasRetencion: false,
	total: 219,
	notes: "Ejemplo con IVA por item",
	ownerId: "6a399e6253da3bf3c3021053",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	clientName: "Cliente Ejemplo",
};

const remisionRequestExample = {
	type: "priced",
	documentType: "remision",
	companyId: "6a399e6253da3bf3c3021049",
	clientId: "6a399e6253da3bf3c3021050",
	driverId: "6a399e6253da3bf3c3021051",
	items: [
		{
			description: "Producto gravado",
			quantity: 1,
			unitPrice: 100,
			hasIva: true,
			ivaPercentage: 19,
		},
		{
			description: "Producto exento",
			quantity: 1,
			unitPrice: 100,
			hasIva: false,
		},
	],
	// Cross-check opcional: debe coincidir con el IVA derivado (19).
	ivaValue: 19,
	hasRetencion: false,
	notes: "Ejemplo con IVA por item",
};

const remisionUpdateExample = {
	notes: "Nota actualizada",
	items: [
		{
			description: "Producto gravado",
			quantity: 1,
			unitPrice: 100,
			hasIva: true,
			ivaPercentage: 19,
		},
		{
			description: "Producto exento",
			quantity: 1,
			unitPrice: 100,
			hasIva: false,
		},
	],
	ivaValue: 19,
};

const remisionResponseExample = {
	success: true,
	data: remisionDataExample,
	message: "Remisión creada exitosamente",
};

const remisionListExample = {
	success: true,
	data: {
		items: [remisionDataExample],
		total: 1,
		limit: 20,
		page: 1,
		totalPages: 1,
	},
	message: "Resultados encontrados exitosamente",
};

const registry = new OpenAPIRegistry();

// Component schemas. `registry.register()` returns the schema with its refId
// attached, which is what makes the response content emit `$ref` instead of an
// inline copy.
const errorEnvelope = registry.register("ErrorEnvelope", errorEnvelopeSchema);
const remision = registry.register("Remision", remisionSchema);
const remisionList = registry.register("RemisionList", remisionListSchema);
registry.register("RemisionItem", remisionItemSchema);

registry.registerComponent("securitySchemes", "bearerAuth", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "JWT",
});

const idParamSchema = z.object({ id: mongoIdSchema });

function successEnvelope(dataSchema: z.ZodTypeAny): z.ZodTypeAny {
	return successEnvelopeSchema.extend({ data: dataSchema });
}

function successResponse(
	dataSchema: z.ZodTypeAny,
	example: unknown,
): ResponseConfig {
	return {
		description: "Respuesta exitosa",
		content: {
			"application/json": {
				schema: successEnvelope(dataSchema),
				example,
			},
		},
	};
}

function errorResponse(description: string): ResponseConfig {
	return {
		description,
		content: {
			"application/json": {
				schema: errorEnvelope,
			},
		},
	};
}

registry.registerPath({
	method: "get",
	path: "/health",
	summary: "Estado del servidor",
	description:
		"Verifica el estado del servidor y la conexión a MongoDB. Público.",
	tags: ["Health"],
	operationId: "getHealth",
	security: [],
	responses: {
		200: {
			description: "Servidor operativo",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						status: z.literal("ok"),
						db: z.literal("connected"),
					}),
					example: { success: true, status: "ok", db: "connected" },
				},
			},
		},
		503: {
			description: "Servidor degradado (MongoDB desconectado)",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						status: z.literal("degraded"),
						db: z.literal("disconnected"),
					}),
					example: { success: false, status: "degraded", db: "disconnected" },
				},
			},
		},
		429: errorResponse("Límite de peticiones excedido"),
	},
});

registry.registerPath({
	method: "post",
	path: "/api/remisiones",
	summary: "Crear remisión",
	description: `Crea una remisión y calcula sus totales.\n${remisionIvaContract}`,
	tags: ["Remisiones"],
	operationId: "createRemision",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			description: "Datos de la remisión",
			required: true,
			content: {
				"application/json": {
					schema: createRemisionSchema,
					example: remisionRequestExample,
				},
			},
		},
	},
	responses: {
		201: successResponse(remision, remisionResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("Sin permiso para usar esta empresa"),
		404: errorResponse("Empresa no encontrada"),
		409: errorResponse("Número consecutivo duplicado para la empresa"),
		422: errorResponse("Validación fallida (incluye el cross-check de IVA)"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/remisiones",
	summary: "Listar remisiones",
	description:
		"Lista las remisiones del usuario autenticado, con paginación y filtros (`search`, `clientName`, `driverName`, `type`, `from`, `to`, `companyId`).",
	tags: ["Remisiones"],
	operationId: "listRemisiones",
	security: [{ bearerAuth: [] }],
	request: {
		query: remisionListQuerySchema,
	},
	responses: {
		200: successResponse(remisionList, remisionListExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		422: errorResponse("Filtros de consulta inválidos"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/remisiones/{id}",
	summary: "Obtener remisión por ID",
	description: "Devuelve una remisión del usuario autenticado.",
	tags: ["Remisiones"],
	operationId: "getRemisionById",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		200: successResponse(remision, remisionResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("Sin permiso para acceder a esta remisión"),
		404: errorResponse("Remisión no encontrada"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/remisiones/{id}",
	summary: "Actualizar remisión",
	description: `Actualiza una remisión del usuario autenticado y recalcula sus totales.\n${remisionIvaContract}${patchHistoricalNote}`,
	tags: ["Remisiones"],
	operationId: "updateRemision",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
		body: {
			description: "Campos a actualizar",
			required: true,
			content: {
				"application/json": {
					schema: updateRemisionSchema,
					example: remisionUpdateExample,
				},
			},
		},
	},
	responses: {
		200: successResponse(remision, remisionResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("Sin permiso para acceder a esta remisión"),
		404: errorResponse("Remisión no encontrada"),
		422: errorResponse(
			"Validación fallida (incluye el cross-check de IVA y el caso histórico)",
		),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/remisiones/{id}",
	summary: "Eliminar remisión",
	description: "Elimina una remisión del usuario autenticado.",
	tags: ["Remisiones"],
	operationId: "deleteRemision",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		204: { description: "Remisión eliminada (sin contenido)" },
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("Sin permiso para acceder a esta remisión"),
		404: errorResponse("Remisión no encontrada"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

type OpenApiDocument = ReturnType<OpenApiGeneratorV3["generateDocument"]>;

let cachedDocument: OpenApiDocument | null = null;

export function buildOpenApiDocument(): OpenApiDocument {
	if (!cachedDocument) {
		cachedDocument = new OpenApiGeneratorV3(
			registry.definitions,
		).generateDocument({
			openapi: "3.0.3",
			info: {
				title: "Remisiones Backend API",
				version: "1.0.0",
				description:
					"API REST para generador de remisiones (con precio + IVA, o solo cantidad). Documentación OpenAPI 3.0.3 generada desde los DTOs Zod, por lo que no puede desincronizarse del contrato de validación.",
			},
			servers: [{ url: "/", description: "Mismo origen (Vercel o local)" }],
		});
	}
	return cachedDocument;
}
