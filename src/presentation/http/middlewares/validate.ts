import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../../../shared/errors/AppError.js";

type Source = "body" | "params" | "query";

export function validate(schema: ZodSchema, source: Source = "body") {
	return (req: Request, _res: Response, next: NextFunction): void => {
		const result = schema.safeParse(req[source]);
		if (!result.success) {
			return next(
				new ValidationError(
					"Error de validación",
					result.error.flatten().fieldErrors,
				),
			);
		}
		// reemplaza con los datos ya parseados/saneados (trim, coerciones, etc.)
		(req as any)[source] = result.data;
		next();
	};
}
