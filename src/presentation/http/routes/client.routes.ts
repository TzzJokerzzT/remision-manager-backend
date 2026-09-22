import { Router } from "express";
import { z } from "zod";
import {
	createClientSchema,
	updateClientSchema,
} from "@/application/dtos/client.dto.js";
import { paginationQuerySchema } from "@/application/dtos/pagination.dto.js";
import { mongoIdSchema } from "@/application/dtos/user.dto.js";
import type { ClientController } from "@/presentation/http/controllers/client.controller.js";
import { authenticate } from "@/presentation/http/middlewares/authenticate.js";
import { validate } from "@/presentation/http/middlewares/validate.js";

export function buildClientRoutes(controller: ClientController): Router {
	const router = Router();
	const idParamSchema = z.object({ id: mongoIdSchema });

	router.use(authenticate);

	router.post("/", validate(createClientSchema), controller.create);
	router.get("/", validate(paginationQuerySchema, "query"), controller.list);
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
