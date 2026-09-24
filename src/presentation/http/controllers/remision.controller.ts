import type { NextFunction, Response } from "express";
import type { RemisionListQueryDTO } from "../../../application/dtos/remision-list-query.dto.js";
import type { RemisionUseCases } from "../../../application/use-cases/remision/RemisionUseCases.js";
import { UnauthorizedError } from "../../../shared/errors/AppError.js";
import type { AuthenticatedRequest } from "../middlewares/authenticate.js";

export class RemisionController {
	constructor(private readonly remisionUseCases: RemisionUseCases) {}

	create = async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			if (!req.user) throw new UnauthorizedError();
			const remision = await this.remisionUseCases.create(
				req.body,
				req.user.id,
				req.user.role,
			);
			res.status(201).json({
				success: true,
				data: remision,
				message: "Remisión creada exitosamente",
			});
		} catch (err) {
			next(err);
		}
	};

	getById = async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			if (!req.user) throw new UnauthorizedError();
			const remision = await this.remisionUseCases.getById(
				req.params.id,
				req.user.id,
				req.user.role,
			);
			res.json({
				success: true,
				data: remision,
				message: "Resultado encontrado exitosamente",
			});
		} catch (err) {
			next(err);
		}
	};

	list = async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			if (!req.user) throw new UnauthorizedError();
			const query = req.query as unknown as RemisionListQueryDTO;
			const remisiones = await this.remisionUseCases.listMine(
				req.user.id,
				query,
			);
			res.json({
				success: true,
				data: remisiones,
				message: "Resultados encontrados exitosamente",
			});
		} catch (err) {
			next(err);
		}
	};

	update = async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			if (!req.user) throw new UnauthorizedError();
			const remision = await this.remisionUseCases.update(
				req.params.id,
				req.body,
				req.user.id,
				req.user.role,
			);
			res.json({
				success: true,
				data: remision,
				message: "Remisión actualizada exitosamente",
			});
		} catch (err) {
			next(err);
		}
	};

	delete = async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			if (!req.user) throw new UnauthorizedError();
			await this.remisionUseCases.delete(
				req.params.id,
				req.user.id,
				req.user.role,
			);
			res
				.status(204)
				.json({ message: "Remisión eliminada exitosamente" })
				.send();
		} catch (err) {
			next(err);
		}
	};
}
