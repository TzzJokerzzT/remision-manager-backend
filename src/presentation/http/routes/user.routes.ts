import { Router } from "express";
import { z } from "zod";
import {
	mongoIdSchema,
	updateUserSchema,
} from "../../../application/dtos/user.dto.js";
import type { UserController } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";

export function buildUserRoutes(controller: UserController): Router {
	const router = Router();
	const idParamSchema = z.object({ id: mongoIdSchema });

	router.use(authenticate);

	router.get("/me", controller.me);
	router.get("/", authorize("admin"), controller.list);
	router.get("/:id", validate(idParamSchema, "params"), controller.getById);
	router.patch(
		"/:id",
		validate(idParamSchema, "params"),
		validate(updateUserSchema),
		controller.update,
	);
	router.delete("/:id", validate(idParamSchema, "params"), controller.delete);

	return router;
}
