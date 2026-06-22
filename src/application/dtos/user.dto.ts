import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  companyLogoUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const mongoIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'ID inválido');
