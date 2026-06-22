import { z } from 'zod';

export const createDriverSchema = z.object({
  name: z.string().trim().min(2).max(150),
  documentId: z.string().trim().min(3).max(30),
  companyId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  licenseNumber: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  vehiclePlate: z.string().trim().max(15).optional(),
});
export type CreateDriverDto = z.infer<typeof createDriverSchema>;

export const updateDriverSchema = createDriverSchema.partial().omit({ companyId: true });
export type UpdateDriverDto = z.infer<typeof updateDriverSchema>;
