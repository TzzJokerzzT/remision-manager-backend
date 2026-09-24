import { z } from "zod";

const itemSchema = z.object({
	description: z.string().trim().min(1).max(250),
	quantity: z.number().positive(),
	unitPrice: z.number().min(0).optional(),
});

export const createRemisionSchema = z
	.object({
		type: z.enum(["priced", "quantity_only"]),
		documentType: z.enum(["remision", "orden_compra"]).default("remision"),
		companyId: z.string().regex(/^[a-fA-F0-9]{24}$/),
		clientId: z.string().regex(/^[a-fA-F0-9]{24}$/),
		driverId: z
			.string()
			.regex(/^[a-fA-F0-9]{24}$/)
			.optional(),
		items: z.array(itemSchema).min(1),
		ivaPercentage: z.number().min(0).max(100).optional(),
		hasRetencion: z.boolean().default(false),
		retencionPercentage: z.number().min(0).max(100).optional(),
		notes: z.string().trim().max(500).optional(),
	})
	.refine(
		(data) =>
			data.type !== "priced" ||
			data.items.every((i) => typeof i.unitPrice === "number"),
		{
			message: 'Cada item debe tener unitPrice cuando type es "priced"',
			path: ["items"],
		},
	)
	.refine(
		(data) => !data.hasRetencion || data.retencionPercentage !== undefined,
		{
			message: "retencionPercentage es requerido cuando hasRetencion es true",
			path: ["retencionPercentage"],
		},
	);
export type CreateRemisionDto = z.infer<typeof createRemisionSchema>;

export const updateRemisionSchema = z
	.object({
		type: z.enum(["priced", "quantity_only"]).optional(),
		documentType: z.enum(["remision", "orden_compra"]).optional(),
		items: z.array(itemSchema).min(1).optional(),
		ivaPercentage: z.number().min(0).max(100).optional(),
		hasRetencion: z.boolean().optional(),
		retencionPercentage: z.number().min(0).max(100).optional(),
		notes: z.string().trim().max(500).optional(),
		driverId: z
			.string()
			.regex(/^[a-fA-F0-9]{24}$/)
			.optional(),
		clientId: z
			.string()
			.regex(/^[a-fA-F0-9]{24}$/)
			.optional(),
	})
	.refine(
		(data) => {
			if (
				data.hasRetencion === true &&
				data.retencionPercentage === undefined
			) {
				return false;
			}
			return true;
		},
		{
			message: "retencionPercentage es requerido cuando hasRetencion es true",
			path: ["retencionPercentage"],
		},
	);
export type UpdateRemisionDto = z.infer<typeof updateRemisionSchema>;
