import { Router } from "express";
import { z } from "zod";
import {
	createClientSchema,
	updateClientSchema,
} from "../../../application/dtos/client.dto.js";
import { mongoIdSchema } from "../../../application/dtos/user.dto.js";
import type { ClientController } from "../controllers/client.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";

export function buildClientRoutes(controller: ClientController): Router {
	const router = Router();
	const idParamSchema = z.object({ id: mongoIdSchema });

	router.use(authenticate);

	router.post("/", validate(createClientSchema), controller.create);
	router.get("/", controller.list);
	router.get("/:id", validate(idParamSchema, "params"), controller.getById);
	router.patch(
		"/:id",
		validate(idParamSchema, "params"),
		validate(updateClientSchema),
		controller.update,
	);
	router.delete("/:id", validate(idParamSchema, "params"), controller.delete);

	return router;
}
