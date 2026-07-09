import { Router } from "express";
import { z } from "zod";
import {
	createDriverSchema,
	updateDriverSchema,
} from "../../../application/dtos/driver.dto.js";
import { mongoIdSchema } from "../../../application/dtos/user.dto.js";
import type { DriverController } from "../controllers/driver.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";

export function buildDriverRoutes(controller: DriverController): Router {
	const router = Router();
	const idParamSchema = z.object({ id: mongoIdSchema });

	router.use(authenticate);

	router.post("/", validate(createDriverSchema), controller.create);
	router.get("/", controller.list);
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
