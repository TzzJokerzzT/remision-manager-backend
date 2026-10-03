import {
	OpenAPIRegistry,
	OpenApiGeneratorV3,
	type ResponseConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
	loginSchema,
	refreshSchema,
	registerSchema,
} from "../../../application/dtos/auth.dto.js";
import {
	createClientSchema,
	updateClientSchema,
} from "../../../application/dtos/client.dto.js";
import {
	createCompanySchema,
	updateCompanySchema,
} from "../../../application/dtos/company.dto.js";
import {
	createDriverSchema,
	updateDriverSchema,
} from "../../../application/dtos/driver.dto.js";
import { paginationQuerySchema } from "../../../application/dtos/pagination.dto.js";
import {
	createRemisionSchema,
	updateRemisionSchema,
} from "../../../application/dtos/remision.dto.js";
import { remisionListQuerySchema } from "../../../application/dtos/remision-list-query.dto.js";
import {
	mongoIdSchema,
	updateUserSchema,
} from "../../../application/dtos/user.dto.js";
import {
	clientListSchema,
	clientSchema,
	companyListSchema,
	companySchema,
	driverListSchema,
	driverSchema,
	errorEnvelopeSchema,
	loginDataSchema,
	registerDataSchema,
	remisionItemSchema,
	remisionListSchema,
	remisionSchema,
	successEnvelopeSchema,
	tokenPairSchema,
	userListSchema,
	userSchema,
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

const userDataExample = {
	id: "6a399e6253da3bf3c3021053",
	name: "Administrador",
	email: "admin@example.com",
	role: "admin",
	companyLogoUrl: null,
	isActive: true,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const companyDataExample = {
	id: "6a399e6253da3bf3c3021049",
	name: "Empresa Ejemplo SAS",
	nit: "900123456-7",
	address: "Calle 123 #45-67",
	phone: "+57 300 123 4567",
	email: "contacto@empresa.com",
	logoUrl: null,
	ownerId: "6a399e6253da3bf3c3021053",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const clientDataExample = {
	id: "6a399e6253da3bf3c3021050",
	name: "Cliente Ejemplo",
	documentId: "901234567",
	address: "Carrera 10 #20-30",
	phone: "+57 300 987 6543",
	email: "cliente@example.com",
	companyId: "6a399e6253da3bf3c3021049",
	ownerId: "6a399e6253da3bf3c3021053",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const driverDataExample = {
	id: "6a399e6253da3bf3c3021051",
	name: "Conductor Ejemplo",
	documentId: "1001234567",
	licenseNumber: "1234567890",
	phone: "+57 310 111 2222",
	vehiclePlate: "ABC123",
	companyId: "6a399e6253da3bf3c3021049",
	ownerId: "6a399e6253da3bf3c3021053",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const registerRequestExample = {
	name: "Nuevo Usuario",
	email: "usuario@example.com",
	password: "Password123",
};

const loginRequestExample = {
	email: "admin@example.com",
	password: "Password123",
};

const refreshRequestExample = {
	refreshToken: "refresh-token-de-ejemplo",
};

const registerResponseExample = {
	success: true,
	data: { user: userDataExample },
	message: "Usuario registrado exitosamente",
};

const loginResponseExample = {
	success: true,
	data: {
		user: userDataExample,
		tokens: {
			accessToken: "<access-token-jwt>",
			refreshToken: "<refresh-token-jwt>",
		},
	},
	message: "Inicio de sesión exitoso",
};

const refreshResponseExample = {
	success: true,
	data: {
		accessToken: "<access-token-jwt>",
		refreshToken: "<refresh-token-jwt>",
	},
};

const logoutResponseExample = {
	success: true,
	message: "Sesión cerrada",
};

const userResponseExample = {
	success: true,
	data: userDataExample,
	message: "Resultado encontrado exitosamente",
};

const userListExample = {
	success: true,
	data: [userDataExample],
	message: "Resultados encontrados exitosamente",
};

const updateUserRequestExample = {
	name: "Nombre Actualizado",
	companyLogoUrl: "https://example.com/logo.png",
	isActive: true,
};

const companyRequestExample = {
	name: "Empresa Ejemplo SAS",
	nit: "900123456-7",
	address: "Calle 123 #45-67",
	phone: "+57 300 123 4567",
	email: "contacto@empresa.com",
	logoUrl: "https://example.com/logo.png",
};

const updateCompanyRequestExample = {
	name: "Empresa Renombrada SAS",
	address: "Nueva dirección",
};

const companyResponseExample = {
	success: true,
	data: companyDataExample,
	message: "Empresa creada exitosamente",
};

const companyListExample = {
	success: true,
	data: {
		items: [companyDataExample],
		total: 1,
		limit: 10,
		page: 1,
		totalPages: 1,
	},
	message: "Resultados encontrados exitosamente",
};

const clientRequestExample = {
	name: "Cliente Ejemplo",
	documentId: "901234567",
	companyId: "6a399e6253da3bf3c3021049",
	address: "Carrera 10 #20-30",
	phone: "+57 300 987 6543",
	email: "cliente@example.com",
};

const updateClientRequestExample = {
	name: "Cliente Renombrado",
	phone: "+57 300 000 0000",
};

const clientResponseExample = {
	success: true,
	data: clientDataExample,
	message: "Se ha creado el cliente exitosamente",
};

const clientListExample = {
	success: true,
	data: {
		items: [clientDataExample],
		total: 1,
		limit: 10,
		page: 1,
		totalPages: 1,
	},
	message: "Resultados encontrados exitosamente",
};

const driverRequestExample = {
	name: "Conductor Ejemplo",
	documentId: "1001234567",
	companyId: "6a399e6253da3bf3c3021049",
	licenseNumber: "1234567890",
	phone: "+57 310 111 2222",
	vehiclePlate: "ABC123",
};

const updateDriverRequestExample = {
	name: "Conductor Renombrado",
	vehiclePlate: "XYZ789",
};

const driverResponseExample = {
	success: true,
	data: driverDataExample,
	message: "Conductor creado exitosamente",
};

const driverListExample = {
	success: true,
	data: {
		items: [driverDataExample],
		total: 1,
		limit: 10,
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

const user = registry.register("User", userSchema);
const userList = registry.register("UserList", userListSchema);
const company = registry.register("Company", companySchema);
const companyList = registry.register("CompanyList", companyListSchema);
const client = registry.register("Client", clientSchema);
const clientList = registry.register("ClientList", clientListSchema);
const driver = registry.register("Driver", driverSchema);
const driverList = registry.register("DriverList", driverListSchema);
const tokenPair = registry.register("TokenPair", tokenPairSchema);
const registerData = registry.register("RegisterData", registerDataSchema);
const loginData = registry.register("LoginData", loginDataSchema);

registry.registerComponent("securitySchemes", "bearerAuth", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "JWT",
});

const idParamSchema = z.object({ id: mongoIdSchema });

// The list controllers read `companyId`/`search` straight from `req.query` and
// `paginationQuerySchema` is `.passthrough()`, so those filters are accepted by
// the API but invisible in the spec unless declared per module.
const companyListQuerySchema = paginationQuerySchema.extend({
	search: z.string().optional(),
});
const clientListQuerySchema = paginationQuerySchema.extend({
	companyId: z.string().optional(),
	search: z.string().optional(),
});
const driverListQuerySchema = paginationQuerySchema.extend({
	companyId: z.string().optional(),
	search: z.string().optional(),
});

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

registry.registerPath({
	method: "post",
	path: "/api/auth/register",
	summary: "Registrar usuario",
	description:
		"Crea un usuario. El primer usuario registrado queda como `admin`; los siguientes como `user`. Público (con límite de peticiones anti fuerza bruta).\n- La contraseña debe tener entre 8 y 100 caracteres e incluir al menos una mayúscula, una minúscula y un número. OpenAPI solo puede emitir uno de los tres patrones, así que los tres se documentan aquí.",
	tags: ["Auth"],
	operationId: "registerUser",
	security: [],
	request: {
		body: {
			description: "Datos de registro",
			required: true,
			content: {
				"application/json": {
					schema: registerSchema,
					example: registerRequestExample,
				},
			},
		},
	},
	responses: {
		201: successResponse(registerData, registerResponseExample),
		409: errorResponse("Ya existe un usuario con ese email"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "post",
	path: "/api/auth/login",
	summary: "Iniciar sesión",
	description:
		"Autentica al usuario y devuelve su perfil junto con un par de tokens (access + refresh). Público (con límite de peticiones anti fuerza bruta).",
	tags: ["Auth"],
	operationId: "loginUser",
	security: [],
	request: {
		body: {
			description: "Credenciales",
			required: true,
			content: {
				"application/json": {
					schema: loginSchema,
					example: loginRequestExample,
				},
			},
		},
	},
	responses: {
		200: successResponse(loginData, loginResponseExample),
		401: errorResponse("Credenciales inválidas"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "post",
	path: "/api/auth/refresh",
	summary: "Renovar tokens",
	description:
		"Rota el par de tokens JWT a partir de un refresh token válido; el refresh token anterior queda invalidado. Público (con límite de peticiones anti fuerza bruta).",
	tags: ["Auth"],
	operationId: "refreshToken",
	security: [],
	request: {
		body: {
			description: "Refresh token a rotar",
			required: true,
			content: {
				"application/json": {
					schema: refreshSchema,
					example: refreshRequestExample,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Tokens renovados",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: tokenPair,
					}),
					example: refreshResponseExample,
				},
			},
		},
		401: errorResponse("Refresh token inválido, expirado o ya usado"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "post",
	path: "/api/auth/logout",
	summary: "Cerrar sesión",
	description: "Invalida el refresh token actual del usuario autenticado.",
	tags: ["Auth"],
	operationId: "logoutUser",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			description: "Sesión cerrada",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						message: z.string(),
					}),
					example: logoutResponseExample,
				},
			},
		},
		401: errorResponse("No autenticado (token ausente o inválido)"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/users/me",
	summary: "Perfil del usuario autenticado",
	description: "Devuelve el perfil del usuario autenticado.",
	tags: ["Users"],
	operationId: "getCurrentUser",
	security: [{ bearerAuth: [] }],
	responses: {
		200: successResponse(user, userResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		404: errorResponse("Usuario no encontrado"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/users",
	summary: "Listar usuarios",
	description: "Lista todos los usuarios. Solo accesible para `admin`.",
	tags: ["Users"],
	operationId: "listUsers",
	security: [{ bearerAuth: [] }],
	responses: {
		200: successResponse(userList, userListExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("Sin permiso (solo admin)"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/users/{id}",
	summary: "Obtener usuario por ID",
	description: "Devuelve un usuario por su ID.",
	tags: ["Users"],
	operationId: "getUserById",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		200: successResponse(user, userResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		404: errorResponse("Usuario no encontrado"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/users/{id}",
	summary: "Actualizar usuario",
	description:
		"Actualiza el nombre, el logo o el estado de un usuario. Un `user` solo puede editar su propio perfil; `admin` puede editar cualquiera.",
	tags: ["Users"],
	operationId: "updateUser",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
		body: {
			description: "Campos a actualizar",
			required: true,
			content: {
				"application/json": {
					schema: updateUserSchema,
					example: updateUserRequestExample,
				},
			},
		},
	},
	responses: {
		200: successResponse(user, userResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No puedes modificar otro usuario"),
		404: errorResponse("Usuario no encontrado"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/users/{id}",
	summary: "Eliminar usuario",
	description:
		"Elimina un usuario. Un `user` solo puede eliminar su propia cuenta; `admin` puede eliminar cualquiera.",
	tags: ["Users"],
	operationId: "deleteUser",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		204: { description: "Usuario eliminado (sin contenido)" },
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No puedes eliminar otro usuario"),
		404: errorResponse("Usuario no encontrado"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "post",
	path: "/api/companies",
	summary: "Crear empresa",
	description: "Crea una empresa para el usuario autenticado.",
	tags: ["Companies"],
	operationId: "createCompany",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			description: "Datos de la empresa",
			required: true,
			content: {
				"application/json": {
					schema: createCompanySchema,
					example: companyRequestExample,
				},
			},
		},
	},
	responses: {
		201: successResponse(company, companyResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		409: errorResponse("Ya existe una empresa con ese NIT"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/companies",
	summary: "Listar empresas",
	description:
		"Lista las empresas del usuario autenticado con paginación y filtro opcional por texto (`search`).",
	tags: ["Companies"],
	operationId: "listCompanies",
	security: [{ bearerAuth: [] }],
	request: {
		query: companyListQuerySchema,
	},
	responses: {
		200: successResponse(companyList, companyListExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		422: errorResponse("Filtros de consulta inválidos"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/companies/{id}",
	summary: "Obtener empresa por ID",
	description: "Devuelve una empresa del usuario autenticado (o `admin`).",
	tags: ["Companies"],
	operationId: "getCompanyById",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		200: successResponse(company, companyResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a esta empresa"),
		404: errorResponse("Empresa no encontrada"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/companies/{id}",
	summary: "Actualizar empresa",
	description: "Actualiza una empresa del usuario autenticado.",
	tags: ["Companies"],
	operationId: "updateCompany",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
		body: {
			description: "Campos a actualizar",
			required: true,
			content: {
				"application/json": {
					schema: updateCompanySchema,
					example: updateCompanyRequestExample,
				},
			},
		},
	},
	responses: {
		200: successResponse(company, companyResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a esta empresa"),
		404: errorResponse("Empresa no encontrada"),
		409: errorResponse(
			"NIT duplicado para el usuario (índice único ownerId + nit)",
		),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/companies/{id}",
	summary: "Eliminar empresa",
	description: "Elimina una empresa del usuario autenticado.",
	tags: ["Companies"],
	operationId: "deleteCompany",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		204: { description: "Empresa eliminada (sin contenido)" },
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a esta empresa"),
		404: errorResponse("Empresa no encontrada"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "post",
	path: "/api/clients",
	summary: "Crear cliente",
	description:
		"Crea un cliente asociado a una empresa. Requiere `companyId`; el usuario debe tener acceso a esa empresa.",
	tags: ["Clients"],
	operationId: "createClient",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			description: "Datos del cliente",
			required: true,
			content: {
				"application/json": {
					schema: createClientSchema,
					example: clientRequestExample,
				},
			},
		},
	},
	responses: {
		201: successResponse(client, clientResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a esta empresa"),
		404: errorResponse("Empresa no encontrada"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/clients",
	summary: "Listar clientes",
	description:
		"Lista los clientes del usuario autenticado con paginación y filtros opcionales (`companyId`, `search`).",
	tags: ["Clients"],
	operationId: "listClients",
	security: [{ bearerAuth: [] }],
	request: {
		query: clientListQuerySchema,
	},
	responses: {
		200: successResponse(clientList, clientListExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		422: errorResponse("Filtros de consulta inválidos"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/clients/{id}",
	summary: "Obtener cliente por ID",
	description: "Devuelve un cliente del usuario autenticado (o `admin`).",
	tags: ["Clients"],
	operationId: "getClientById",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		200: successResponse(client, clientResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a este cliente"),
		404: errorResponse("Cliente no encontrado"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/clients/{id}",
	summary: "Actualizar cliente",
	description: "Actualiza un cliente del usuario autenticado.",
	tags: ["Clients"],
	operationId: "updateClient",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
		body: {
			description: "Campos a actualizar",
			required: true,
			content: {
				"application/json": {
					schema: updateClientSchema,
					example: updateClientRequestExample,
				},
			},
		},
	},
	responses: {
		200: successResponse(client, clientResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a este cliente"),
		404: errorResponse("Cliente no encontrado"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/clients/{id}",
	summary: "Eliminar cliente",
	description: "Elimina un cliente del usuario autenticado.",
	tags: ["Clients"],
	operationId: "deleteClient",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		204: { description: "Cliente eliminado (sin contenido)" },
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a este cliente"),
		404: errorResponse("Cliente no encontrado"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "post",
	path: "/api/drivers",
	summary: "Crear conductor",
	description:
		"Crea un conductor asociado a una empresa. Requiere `companyId`; el usuario debe tener acceso a esa empresa.",
	tags: ["Drivers"],
	operationId: "createDriver",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			description: "Datos del conductor",
			required: true,
			content: {
				"application/json": {
					schema: createDriverSchema,
					example: driverRequestExample,
				},
			},
		},
	},
	responses: {
		201: successResponse(driver, driverResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a esta empresa"),
		404: errorResponse("Empresa no encontrada"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/drivers",
	summary: "Listar conductores",
	description:
		"Lista los conductores del usuario autenticado con paginación y filtros opcionales (`companyId`, `search`).",
	tags: ["Drivers"],
	operationId: "listDrivers",
	security: [{ bearerAuth: [] }],
	request: {
		query: driverListQuerySchema,
	},
	responses: {
		200: successResponse(driverList, driverListExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		422: errorResponse("Filtros de consulta inválidos"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "get",
	path: "/api/drivers/{id}",
	summary: "Obtener conductor por ID",
	description: "Devuelve un conductor del usuario autenticado (o `admin`).",
	tags: ["Drivers"],
	operationId: "getDriverById",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		200: successResponse(driver, driverResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a este conductor"),
		404: errorResponse("Conductor no encontrado"),
		422: errorResponse("ID inválido"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/drivers/{id}",
	summary: "Actualizar conductor",
	description: "Actualiza un conductor del usuario autenticado.",
	tags: ["Drivers"],
	operationId: "updateDriver",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
		body: {
			description: "Campos a actualizar",
			required: true,
			content: {
				"application/json": {
					schema: updateDriverSchema,
					example: updateDriverRequestExample,
				},
			},
		},
	},
	responses: {
		200: successResponse(driver, driverResponseExample),
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a este conductor"),
		404: errorResponse("Conductor no encontrado"),
		422: errorResponse("Validación fallida"),
		429: errorResponse("Límite de peticiones excedido"),
		500: errorResponse("Error interno del servidor"),
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/drivers/{id}",
	summary: "Eliminar conductor",
	description: "Elimina un conductor del usuario autenticado.",
	tags: ["Drivers"],
	operationId: "deleteDriver",
	security: [{ bearerAuth: [] }],
	request: {
		params: idParamSchema,
	},
	responses: {
		204: { description: "Conductor eliminado (sin contenido)" },
		401: errorResponse("No autenticado (token ausente o inválido)"),
		403: errorResponse("No tienes acceso a este conductor"),
		404: errorResponse("Conductor no encontrado"),
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
