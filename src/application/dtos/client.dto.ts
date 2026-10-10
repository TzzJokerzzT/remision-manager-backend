import { z } from "zod";

export const createClientSchema = z.object({
	name: z
		.string()
		.trim()
		.min(2)
		.max(150)
		.regex(/^[^<>]*$/, "Caracteres no permitidos"),
	documentId: z
		.string()
		.trim()
		.min(3)
		.max(30)
		.regex(/^[^<>]*$/, "Caracteres no permitidos"),
	companyId: z.string().regex(/^[a-fA-F0-9]{24}$/),
	address: z
		.string()
		.trim()
		.max(250)
		.regex(/^[^<>]*$/, "Caracteres no permitidos")
		.optional(),
	phone: z
		.string()
		.trim()
		.max(30)
		.regex(/^[^<>]*$/, "Caracteres no permitidos")
		.optional(),
	email: z
		.string()
		.trim()
		.email()
		.max(200)
		.regex(/^[^<>]*$/, "Caracteres no permitidos")
		.optional(),
});
export type CreateClientDto = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema
	.partial()
	.omit({ companyId: true });
export type UpdateClientDto = z.infer<typeof updateClientSchema>;
