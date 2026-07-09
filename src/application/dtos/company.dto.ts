import { z } from "zod";

export const createCompanySchema = z.object({
	name: z.string().trim().min(2).max(150),
	nit: z.string().trim().min(3).max(30),
	address: z.string().trim().max(250).optional(),
	phone: z.string().trim().max(30).optional(),
	email: z.string().trim().email().max(200).optional(),
	logoUrl: z.string().url().max(500).optional(),
});
export type CreateCompanyDto = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema.partial();
export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;
