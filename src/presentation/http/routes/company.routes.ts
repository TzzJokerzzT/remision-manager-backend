import { Router } from "express";
import { z } from "zod";
import {
	createCompanySchema,
	updateCompanySchema,
} from "../../../application/dtos/company.dto.js";
import { mongoIdSchema } from "../../../application/dtos/user.dto.js";
import type { CompanyController } from "../controllers/company.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";

export function buildCompanyRoutes(controller: CompanyController): Router {
	const router = Router();
	const idParamSchema = z.object({ id: mongoIdSchema });

	router.use(authenticate);

	router.post("/", validate(createCompanySchema), controller.create);
	router.get("/", controller.list);
	router.get("/:id", validate(idParamSchema, "params"), controller.getById);
	router.patch(
		"/:id",
		validate(idParamSchema, "params"),
		validate(updateCompanySchema),
		controller.update,
	);
	router.delete("/:id", validate(idParamSchema, "params"), controller.delete);

	return router;
}
