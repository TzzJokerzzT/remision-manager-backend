import rateLimit from "express-rate-limit";
import { env } from "../../../config/env.js";

export const generalLimiter = rateLimit({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	limit: env.RATE_LIMIT_MAX,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Demasiadas solicitudes, intenta de nuevo más tarde",
	},
});

// Límite más estricto para endpoints sensibles de auth (fuerza bruta)
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Demasiados intentos, intenta de nuevo más tarde",
	},
});
