import { Router } from "express";
import { z } from "zod";
import {
	createDriverSchema,
	updateDriverSchema,
} from "@/application/dtos/driver.dto.js";
import { paginationQuerySchema } from "@/application/dtos/pagination.dto.js";
import { mongoIdSchema } from "@/application/dtos/user.dto.js";
import type { DriverController } from "@/presentation/http/controllers/driver.controller.js";
import { authenticate } from "@/presentation/http/middlewares/authenticate.js";
import { validate } from "@/presentation/http/middlewares/validate.js";

export function buildDriverRoutes(controller: DriverController): Router {
	const router = Router();
	const idParamSchema = z.object({ id: mongoIdSchema });

	router.use(authenticate);

	router.post("/", validate(createDriverSchema), controller.create);
	router.get("/", validate(paginationQuerySchema, "query"), controller.list);
	router.get("/:id", validate(idParamSchema, "params"), controller.getById);
	router.patch(
		"/:id",
		validate(idParamSchema, "params"),
		validate(updateDriverSchema),
		controller.update,
	);
	router.delete("/:id", validate(idParamSchema, "params"), controller.delete);

	return router;
}
