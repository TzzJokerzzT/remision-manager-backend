import { z } from "zod";

const itemSchema = z.object({
	description: z.string().trim().min(1).max(250),
	quantity: z.number().positive(),
	unitPrice: z.number().min(0).optional(),
	hasIva: z.boolean(),
	ivaPercentage: z.number().min(0).max(100).optional(),
});

function refineItemIva(
	data: { items?: Array<{ hasIva: boolean; ivaPercentage?: number }> },
	ctx: z.RefinementCtx,
) {
	data.items?.forEach((item, index) => {
		if (
			item.hasIva === true &&
			(item.ivaPercentage === undefined || item.ivaPercentage <= 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"ivaPercentage es requerido y debe ser mayor a 0 cuando hasIva es true",
				path: ["items", index, "ivaPercentage"],
			});
		}
		if (
			item.hasIva === false &&
			item.ivaPercentage !== undefined &&
			item.ivaPercentage > 0
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"ivaPercentage debe ser 0 o estar ausente cuando hasIva es false",
				path: ["items", index, "ivaPercentage"],
			});
		}
	});
}

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
		ivaValue: z.number().min(0).optional(),
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
	)
	.superRefine(refineItemIva);
export type CreateRemisionDto = z.infer<typeof createRemisionSchema>;

export const updateRemisionSchema = z
	.object({
		type: z.enum(["priced", "quantity_only"]).optional(),
		documentType: z.enum(["remision", "orden_compra"]).optional(),
		items: z.array(itemSchema).min(1).optional(),
		ivaValue: z.number().min(0).optional(),
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
	.superRefine(refineItemIva);
export type UpdateRemisionDto = z.infer<typeof updateRemisionSchema>;
