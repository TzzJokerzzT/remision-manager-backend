import type { NextFunction, Request, Response } from "express";
import { JwtService } from "../../../infrastructure/security/jwt.service.js";
import { UnauthorizedError } from "../../../shared/errors/AppError.js";

export interface AuthenticatedRequest extends Request {
	user?: { id: string; role: "admin" | "user" };
}

export function authenticate(
	req: AuthenticatedRequest,
	_res: Response,
	next: NextFunction,
): void {
	// Skip authentication for CORS preflight requests
	if (req.method === "OPTIONS") {
		next();
		return;
	}

	const header = req.headers.authorization;
	if (!header || !header.startsWith("Bearer ")) {
		next(new UnauthorizedError("Token no proporcionado"));
		return;
	}
	const token = header.slice(7);
	try {
		const payload = JwtService.verifyAccessToken(token);
		req.user = { id: payload.sub, role: payload.role };
		next();
	} catch {
		next(new UnauthorizedError("Token inválido o expirado"));
	}
}
