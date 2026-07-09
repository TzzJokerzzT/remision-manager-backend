import type { NextFunction, Response } from "express";
import type { DriverUseCases } from "../../../application/use-cases/driver/DriverUseCases.js";
import type { AuthenticatedRequest } from "../middlewares/authenticate.js";

export class DriverController {
	constructor(private readonly driverUseCases: DriverUseCases) {}

	create = async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const driver = await this.driverUseCases.create(
				req.body,
				req.user!.id,
				req.user!.role,
			);
			res.status(201).json({
				success: true,
				data: driver,
				message: "Conductor creado exitosamente",
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
			const driver = await this.driverUseCases.getById(
				req.params.id,
				req.user!.id,
				req.user!.role,
			);
			res.json({
				success: true,
				data: driver,
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
			const companyId =
				typeof req.query.companyId === "string"
					? req.query.companyId
					: undefined;
			const search =
				typeof req.query.search === "string" ? req.query.search : undefined;
			const drivers = await this.driverUseCases.listMine(
				req.user!.id,
				companyId,
				search,
			);
			res.json({
				success: true,
				data: drivers,
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
			const driver = await this.driverUseCases.update(
				req.params.id,
				req.body,
				req.user!.id,
				req.user!.role,
			);
			res.json({
				success: true,
				data: driver,
				message: "Conductor actualizado exitosamente",
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
			await this.driverUseCases.delete(
				req.params.id,
				req.user!.id,
				req.user!.role,
			);
			res
				.status(204)
				.json({ message: "Conductor eliminado exitosamente" })
				.send();
		} catch (err) {
			next(err);
		}
	};
}
