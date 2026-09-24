import cors from "cors";
import express, { type Application } from "express";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import hpp from "hpp";
import pinoHttp from "pino-http";

import { env } from "../../config/env.js";
import {
	authController,
	clientController,
	companyController,
	driverController,
	remisionController,
	userController,
} from "../../di/container.js";
import mongoose from "mongoose";
import { logger } from "../../shared/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { generalLimiter } from "./middlewares/rateLimiter.js";
import { buildAuthRoutes } from "./routes/auth.routes.js";
import { buildClientRoutes } from "./routes/client.routes.js";
import { buildCompanyRoutes } from "./routes/company.routes.js";
import { buildDriverRoutes } from "./routes/driver.routes.js";
import { buildRemisionRoutes } from "./routes/remision.routes.js";
import { buildUserRoutes } from "./routes/user.routes.js";

import type { AuthenticatedRequest } from "./middlewares/authenticate.js";

export function createServer(): Application {
	const app = express();

	// --- Seguridad base ---
	app.disable("x-powered-by");
	app.set("trust proxy", 1);

	app.use(
		helmet({
			crossOriginResourcePolicy: { policy: "cross-origin" },
		}),
	);

	const corsOptions: cors.CorsOptions = {
		origin: (origin, callback) => {
			const normalized = origin ? origin.replace(/\/+$/, "") : undefined;
			if (!normalized || env.CORS_ORIGINS_LIST.includes(normalized)) {
				callback(null, true);
			} else {
				callback(null, false);
			}
		},
		credentials: true,
		methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
	};

	app.use(cors(corsOptions));
	app.options("*", cors(corsOptions));

	app.use(express.json({ limit: "1mb" }));
	app.use(express.urlencoded({ extended: true, limit: "1mb" }));

	app.use(
		mongoSanitize({
			replaceWith: "_",
		}),
	);

	app.use(hpp());

	app.use(generalLimiter);

	// Request ID middleware (always active)
	app.use((req, res, next) => {
		const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
		req.requestId = id;
		req.headers["x-request-id"] = id;
		res.setHeader("X-Request-Id", id);
		next();
	});

	// Structured logging (skip in test to avoid noisy output)
	if (env.NODE_ENV !== "test") {
		app.use(
			pinoHttp({
				logger,
				genReqId: (req) =>
					(req.headers["x-request-id"] as string) || crypto.randomUUID(),
				customProps: (req) => {
					const user = (req as AuthenticatedRequest).user;
					return { userId: user?.id ?? null };
				},
			}),
		);
	}

	// --- Rutas ---
	app.get("/health", (_req, res) => {
		const dbConnected = mongoose.connection.readyState === 1;
		if (dbConnected) {
			res.json({ success: true, status: "ok", db: "connected" });
		} else {
			res
				.status(503)
				.json({ success: false, status: "degraded", db: "disconnected" });
		}
	});

	app.use("/api/auth", buildAuthRoutes(authController));
	app.use("/api/users", buildUserRoutes(userController));
	app.use("/api/companies", buildCompanyRoutes(companyController));
	app.use("/api/clients", buildClientRoutes(clientController));
	app.use("/api/drivers", buildDriverRoutes(driverController));
	app.use("/api/remisiones", buildRemisionRoutes(remisionController));

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
