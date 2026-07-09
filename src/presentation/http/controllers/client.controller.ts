import type { NextFunction, Response } from "express";
import type { ClientUseCases } from "../../../application/use-cases/client/ClientUseCases.js";
import type { AuthenticatedRequest } from "../middlewares/authenticate.js";

export class ClientController {
	constructor(private readonly clientUseCases: ClientUseCases) {}

	create = async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const client = await this.clientUseCases.create(
				req.body,
				req.user!.id,
				req.user!.role,
			);
			res.status(201).json({
				success: true,
				data: client,
				message: "Se ha creado el cliente exitosamente",
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
			const client = await this.clientUseCases.getById(
				req.params.id,
				req.user!.id,
				req.user!.role,
			);
			res.json({
				success: true,
				data: client,
				message: "Resultados encontrados",
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
			const companyId =
				typeof req.query.companyId === "string"
					? req.query.companyId
					: undefined;
			const search =
				typeof req.query.search === "string" ? req.query.search : undefined;
			const clients = await this.clientUseCases.listMine(
				req.user!.id,
				companyId,
				search,
			);
			res.json({
				success: true,
				data: clients,
				messsage: "Resultados encontrados exitosamente",
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
			const client = await this.clientUseCases.update(
				req.params.id,
				req.body,
				req.user!.id,
				req.user!.role,
			);
			res.json({
				success: true,
				data: client,
				message: "Cliente actualizado exitosamente",
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
			await this.clientUseCases.delete(
				req.params.id,
				req.user!.id,
				req.user!.role,
			);
			res
				.status(204)
				.json({ message: "Cliente eliminado exitosamnete" })
				.send();
		} catch (err) {
			next(err);
		}
	};
}
