import { z } from "zod";

const optionalTrimmedName = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim().length > 0
			? value.trim()
			: undefined,
	z.string().min(1).max(150).optional(),
);

const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTime =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/;

const fromQuery = z
	.string()
	.trim()
	.refine((value) => isoDateOnly.test(value) || isoDateTime.test(value), {
		message: "from must be an ISO date (YYYY-MM-DD) or ISO datetime",
	})
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "from is not a valid date",
	})
	.transform((value) => new Date(value))
	.optional();

const toQuery = z
	.string()
	.trim()
	.refine((value) => isoDateOnly.test(value) || isoDateTime.test(value), {
		message: "to must be an ISO date (YYYY-MM-DD) or ISO datetime",
	})
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "to is not a valid date",
	})
	.transform((value) => {
		const date = new Date(value);
		// Date-only "to" is end-of-day (inclusive full day) in UTC.
		if (isoDateOnly.test(value)) {
			date.setUTCHours(23, 59, 59, 999);
		}
		return date;
	})
	.optional();

export const remisionListQuerySchema = z
	.object({
		limit: z.coerce.number().int().positive().max(100).default(20),
		page: z.coerce.number().int().positive().default(1),
		companyId: z.string().trim().optional(),
		search: z.string().trim().optional(),
		clientName: optionalTrimmedName,
		driverName: optionalTrimmedName,
		type: z.enum(["priced", "quantity_only"]).optional(),
		from: fromQuery,
		to: toQuery,
	})
	.refine(
		(data) =>
			data.from === undefined ||
			data.to === undefined ||
			data.from.getTime() <= data.to.getTime(),
		{
			message: "from must be on or before to",
			path: ["from"],
		},
	);
// No .passthrough(): unknown query keys are stripped so unvalidated filter
// values never reach the controller (spec: "Boundary Validation").

export type RemisionListQueryDTO = z.infer<typeof remisionListQuerySchema>;
