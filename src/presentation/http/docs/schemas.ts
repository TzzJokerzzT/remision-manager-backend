import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { PaginationResponseDTO } from "../../../application/dtos/pagination.dto.js";
import type { Remision } from "../../../domain/entities/Remision.js";

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
