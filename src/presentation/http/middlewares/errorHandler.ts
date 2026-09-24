import type { NextFunction, Request, Response } from "express";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { logger } from "../../../shared/logger.js";

export function notFoundHandler(req: Request, res: Response): void {
	res.status(404).json({
		success: false,
		message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
	});
}

export function errorHandler(
	err: unknown,
	req: Request,
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
	if (
		typeof err === "object" &&
		err !== null &&
		(err as { code?: number }).code === 11000
	) {
		res.status(409).json({
			success: false,
			message: "El recurso ya existe (valor duplicado)",
		});
		return;
	}

	const log = req.log ?? logger;
	log.error({ err }, "Unhandled error");
	res.status(500).json({
		success: false,
		message: "Error interno del servidor",
		...(env.NODE_ENV === "development" ? { stack: (err as Error)?.stack } : {}),
	});
}
