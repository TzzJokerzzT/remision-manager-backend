import type { NextFunction, Request, Response } from "express";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";

export function notFoundHandler(req: Request, res: Response): void {
	res.status(404).json({
		success: false,
		message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
	});
}

export function errorHandler(
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void {
	if (err instanceof AppError) {
		res.status(err.statusCode).json({
			success: false,
			message: err.message,
			details: err.details,
		});
		return;
	}

	// Errores de duplicado de Mongo (índice unique)
	if (typeof err === "object" && err !== null && (err as any).code === 11000) {
		res.status(409).json({
			success: false,
			message: "El recurso ya existe (valor duplicado)",
		});
		return;
	}

	console.error("💥 Error no controlado:", err);
	res.status(500).json({
		success: false,
		message: "Error interno del servidor",
		...(env.NODE_ENV === "development" ? { stack: (err as Error)?.stack } : {}),
	});
}
