import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "@/presentation/http/middlewares/authenticate.js";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors/AppError.js";

export function authorize(...roles: Array<"admin" | "user">) {
	return (
		req: AuthenticatedRequest,
		_res: Response,
		next: NextFunction,
	): void => {
		if (!req.user) {
			next(new UnauthorizedError());
			return;
		}
		if (!roles.includes(req.user.role)) {
			next(new ForbiddenError("No tienes permisos para esta acción"));
			return;
		}
		next();
	};
}
