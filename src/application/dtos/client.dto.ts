import { z } from "zod";

export const createClientSchema = z.object({
	name: z.string().trim().min(2).max(150),
	documentId: z.string().trim().min(3).max(30),
	companyId: z.string().regex(/^[a-fA-F0-9]{24}$/),
	address: z.string().trim().max(250).optional(),
	phone: z.string().trim().max(30).optional(),
	email: z.string().trim().email().max(200).optional(),
});
export type CreateClientDto = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema
	.partial()
	.omit({ companyId: true });
export type UpdateClientDto = z.infer<typeof updateClientSchema>;
