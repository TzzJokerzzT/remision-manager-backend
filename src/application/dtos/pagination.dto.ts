import { z } from "zod";

export interface PaginationDTO {
	limit: number;
	page: number;
}

export interface PaginationResponseDTO<T> {
	items: T[];
	total: number;
	limit: number;
	page: number;
	totalPages: number;
}

// Express query values arrive as strings; coerce before validating.
// .passthrough() is REQUIRED: validate() replaces req.query wholesale, and
// default strip mode would drop the pre-existing `search`/`companyId` keys.
export const paginationQuerySchema = z
	.object({
		limit: z.coerce.number().int().positive().max(100).default(10),
		page: z.coerce.number().int().positive().default(1),
	})
	.passthrough();

export function buildPaginationResponse<T>(
	items: T[],
	total: number,
	limit: number,
	page: number,
): PaginationResponseDTO<T> {
	return {
		items,
		total,
		limit,
		page,
		totalPages: Math.ceil(total / limit),
	};
}
