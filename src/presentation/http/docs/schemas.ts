import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { PaginationResponseDTO } from "../../../application/dtos/pagination.dto.js";
import type { Client } from "../../../domain/entities/Client.js";
import type { Company } from "../../../domain/entities/Company.js";
import type { Driver } from "../../../domain/entities/Driver.js";
import type { Remision } from "../../../domain/entities/Remision.js";
import type { SafeUser } from "../../../domain/entities/User.js";

// `.openapi()` also powers the `registry.register()` calls in openapi.ts, so it
// must be applied once before any schema below is defined.
extendZodWithOpenApi(z);

// --- Compile-time drift guards -------------------------------------------
// The entities are plain TypeScript interfaces (no Zod schema), so the response
// schemas live here. Each guard asserts a two-way type equality between the
// inferred schema output and the JSON shape of the entity: a missing field AND
// an extra field both fail `tsc --noEmit`.
type Jsonify<T> = T extends Date
	? string
	: T extends Array<infer U>
		? Array<Jsonify<U>>
		: T extends object
			? { [K in keyof T]: Jsonify<T[K]> }
			: T;

type IsEqual<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
			? true
			: false
		: false;

type Assert<T extends true> = T;

type RemisionWithClient = Remision & { clientName: string };

export const remisionItemSchema = z
	.object({
		description: z.string(),
		quantity: z.number(),
		unitPrice: z.number().optional(),
		hasIva: z.boolean().optional(),
		ivaPercentage: z.number().optional(),
		ivaValue: z.number().optional(),
	})
	.openapi("RemisionItem", {
		description: "Item de una remisión con IVA por item.",
	});

export const remisionSchema = z
	.object({
		id: z.string(),
		consecutive: z.number(),
		type: z.enum(["priced", "quantity_only"]),
		documentType: z.enum(["remision", "orden_compra"]),
		companyId: z.string(),
		clientId: z.string(),
		driverId: z.string().optional(),
		items: z.array(remisionItemSchema),
		subtotal: z.number().optional(),
		ivaValue: z.number().optional(),
		hasRetencion: z.boolean(),
		retencionPercentage: z.number().optional(),
		retencionValue: z.number().optional(),
		total: z.number().optional(),
		notes: z.string().optional(),
		ownerId: z.string(),
		createdAt: z.string(),
		updatedAt: z.string(),
		clientName: z.string(),
	})
	.openapi("Remision", {
		description: "Remisión devuelta por la API (incluye `clientName`).",
	});

export const remisionListSchema = z
	.object({
		items: z.array(remisionSchema),
		total: z.number(),
		limit: z.number(),
		page: z.number(),
		totalPages: z.number(),
	})
	.openapi("RemisionList", {
		description:
			"Página de remisiones (`items`, `total`, `limit`, `page`, `totalPages`).",
	});

export const userSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		role: z.enum(["admin", "user"]),
		companyLogoUrl: z.string().url().max(500).nullable().optional(),
		isActive: z.boolean(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.openapi("User", {
		description: "Usuario devuelto por la API (sin `passwordHash`).",
	});

// `GET /api/users` devuelve un arreglo plano de usuarios, no una página.
export const userListSchema = z.array(userSchema).openapi("UserList", {
	description: "Lista de usuarios (arreglo plano).",
});

export const companySchema = z
	.object({
		id: z.string(),
		name: z.string(),
		nit: z.string(),
		address: z.string().optional(),
		phone: z.string().optional(),
		email: z.string().optional(),
		logoUrl: z.string().url().max(500).nullable().optional(),
		ownerId: z.string(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.openapi("Company", {
		description: "Empresa devuelta por la API.",
	});

export const companyListSchema = z
	.object({
		items: z.array(companySchema),
		total: z.number(),
		limit: z.number(),
		page: z.number(),
		totalPages: z.number(),
	})
	.openapi("CompanyList", {
		description:
			"Página de empresas (`items`, `total`, `limit`, `page`, `totalPages`).",
	});

export const clientSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		documentId: z.string(),
		address: z.string().optional(),
		phone: z.string().optional(),
		email: z.string().optional(),
		companyId: z.string(),
		ownerId: z.string(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.openapi("Client", {
		description: "Cliente devuelto por la API.",
	});

export const clientListSchema = z
	.object({
		items: z.array(clientSchema),
		total: z.number(),
		limit: z.number(),
		page: z.number(),
		totalPages: z.number(),
	})
	.openapi("ClientList", {
		description:
			"Página de clientes (`items`, `total`, `limit`, `page`, `totalPages`).",
	});

export const driverSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		documentId: z.string(),
		licenseNumber: z.string().optional(),
		phone: z.string().optional(),
		vehiclePlate: z.string().optional(),
		companyId: z.string(),
		ownerId: z.string(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.openapi("Driver", {
		description: "Conductor devuelto por la API.",
	});

export const driverListSchema = z
	.object({
		items: z.array(driverSchema),
		total: z.number(),
		limit: z.number(),
		page: z.number(),
		totalPages: z.number(),
	})
	.openapi("DriverList", {
		description:
			"Página de conductores (`items`, `total`, `limit`, `page`, `totalPages`).",
	});

// Los datos de auth no tienen entidad de dominio propia: se derivan de los
// tipos de retorno de los casos de uso y los controllers (sin drift guard).
export const tokenPairSchema = z
	.object({
		accessToken: z.string(),
		refreshToken: z.string(),
	})
	.openapi("TokenPair", {
		description: "Par de tokens JWT (access + refresh).",
	});

export const registerDataSchema = z
	.object({
		user: userSchema,
	})
	.openapi("RegisterData", {
		description: "Usuario registrado (`data` del envoltorio de éxito).",
	});

export const loginDataSchema = z
	.object({
		user: userSchema,
		tokens: tokenPairSchema,
	})
	.openapi("LoginData", {
		description: "Usuario y tokens del login (`data` del envoltorio de éxito).",
	});

// Shape reference for the success envelope. Each operation extends it with a
// concrete `data` schema (`successEnvelope()` in openapi.ts), so it is not a
// registered component: a shared ref would dangle once `data` differs.
export const successEnvelopeSchema = z.object({
	success: z.literal(true),
	data: z.unknown(),
	message: z.string(),
});

export const errorEnvelopeSchema = z
	.object({
		success: z.literal(false),
		message: z.string(),
		details: z.unknown().optional(),
	})
	.openapi("ErrorEnvelope", {
		description:
			"Envoltorio de error (`success: false`, `message`, `details` opcional).",
	});

// --- Drift guards (evaluated by tsc, unused at runtime) ---
export type RemisionSchemaDriftGuard = Assert<
	IsEqual<z.infer<typeof remisionSchema>, Jsonify<RemisionWithClient>>
>;

export type RemisionListSchemaDriftGuard = Assert<
	IsEqual<
		z.infer<typeof remisionListSchema>,
		Jsonify<PaginationResponseDTO<RemisionWithClient>>
	>
>;

export type UserSchemaDriftGuard = Assert<
	IsEqual<z.infer<typeof userSchema>, Jsonify<SafeUser>>
>;

export type UserListSchemaDriftGuard = Assert<
	IsEqual<z.infer<typeof userListSchema>, Jsonify<SafeUser[]>>
>;

export type CompanySchemaDriftGuard = Assert<
	IsEqual<z.infer<typeof companySchema>, Jsonify<Company>>
>;

export type CompanyListSchemaDriftGuard = Assert<
	IsEqual<
		z.infer<typeof companyListSchema>,
		Jsonify<PaginationResponseDTO<Company>>
	>
>;

export type ClientSchemaDriftGuard = Assert<
	IsEqual<z.infer<typeof clientSchema>, Jsonify<Client>>
>;

export type ClientListSchemaDriftGuard = Assert<
	IsEqual<
		z.infer<typeof clientListSchema>,
		Jsonify<PaginationResponseDTO<Client>>
	>
>;

export type DriverSchemaDriftGuard = Assert<
	IsEqual<z.infer<typeof driverSchema>, Jsonify<Driver>>
>;

export type DriverListSchemaDriftGuard = Assert<
	IsEqual<
		z.infer<typeof driverListSchema>,
		Jsonify<PaginationResponseDTO<Driver>>
	>
>;
