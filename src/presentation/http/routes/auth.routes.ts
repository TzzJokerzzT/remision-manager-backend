import { Router } from "express";
import {
	loginSchema,
	refreshSchema,
	registerSchema,
} from "../../../application/dtos/auth.dto.js";
import type { AuthController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authLimiter } from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validate.js";

export function buildAuthRoutes(controller: AuthController): Router {
	const router = Router();

	router.post(
		"/register",
		authLimiter,
		validate(registerSchema),
		controller.register,
	);
	router.post("/login", authLimiter, validate(loginSchema), controller.login);
	router.post(
		"/refresh",
		authLimiter,
		validate(refreshSchema),
		controller.refresh,
	);
	router.post("/logout", authenticate, controller.logout);

	return router;
}
