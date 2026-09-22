import type { NextFunction, Response } from "express";
import {
	ForbiddenError,
	UnauthorizedError,
} from "../../../shared/errors/AppError.js";
import type { AuthenticatedRequest } from "./authenticate.js";

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
