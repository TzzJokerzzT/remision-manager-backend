import type { Remision } from "../../../domain/entities/Remision.js";
import type { ICompanyRepository } from "../../../domain/repositories/ICompanyRepository.js";
import type { IRemisionRepository } from "../../../domain/repositories/IRemisionRepository.js";
import { computeRemisionTotals } from "../../../domain/services/remisionTotals.js";
import {
	ForbiddenError,
	NotFoundError,
} from "../../../shared/errors/AppError.js";
import {
	buildPaginationResponse,
	type PaginationDTO,
	type PaginationResponseDTO,
} from "../../dtos/pagination.dto.js";
import type {
	CreateRemisionDto,
	UpdateRemisionDto,
} from "../../dtos/remision.dto.js";

export class RemisionUseCases {
	constructor(
		private readonly remisionRepo: IRemisionRepository,
		private readonly companyRepo: ICompanyRepository,
	) {}

	async create(
		dto: CreateRemisionDto,
		ownerId: string,
		role: "admin" | "user",
	): Promise<Remision> {
		const company = await this.companyRepo.findById(dto.companyId);
		if (!company) throw new NotFoundError("Empresa");
		if (role !== "admin" && company.ownerId !== ownerId) {
			throw new ForbiddenError("No tienes acceso a esta empresa");
		}

		const consecutive = await this.remisionRepo.getNextConsecutive(
			dto.companyId,
		);
		const totals = computeRemisionTotals(
			dto.items,
			dto.type,
			dto.ivaPercentage,
		);

		return this.remisionRepo.create({
			...dto,
			consecutive,
			ownerId,
			...totals,
		});
	}

	async getById(
		id: string,
		requesterId: string,
		role: "admin" | "user",
	): Promise<Remision> {
		const remision = await this.remisionRepo.findById(id);
		if (!remision) throw new NotFoundError("Remisión");
		this.assertOwnership(remision, requesterId, role);
		return remision;
	}

	async listMine(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination: PaginationDTO = { limit: 10, page: 1 },
	): Promise<PaginationResponseDTO<Remision>> {
		const { items, total } = await this.remisionRepo.listByOwner(
			ownerId,
			companyId,
			search,
			pagination,
		);
		return buildPaginationResponse(
			items,
			total,
			pagination.limit,
			pagination.page,
		);
	}

	async update(
		id: string,
		dto: UpdateRemisionDto,
		requesterId: string,
		role: "admin" | "user",
	): Promise<Remision> {
		const remision = await this.remisionRepo.findById(id);
		if (!remision) throw new NotFoundError("Remisión");
		this.assertOwnership(remision, requesterId, role);

		const items = dto.items ?? remision.items;
		const ivaPercentage = dto.ivaPercentage ?? remision.ivaPercentage;
		const totals = computeRemisionTotals(items, remision.type, ivaPercentage);

		const updated = await this.remisionRepo.update(id, { ...dto, ...totals });
		if (!updated) throw new NotFoundError("Remisión");
		return updated;
	}

	async delete(
		id: string,
		requesterId: string,
		role: "admin" | "user",
	): Promise<void> {
		const remision = await this.remisionRepo.findById(id);
		if (!remision) throw new NotFoundError("Remisión");
		this.assertOwnership(remision, requesterId, role);
		await this.remisionRepo.delete(id);
	}

	private assertOwnership(
		remision: Remision,
		requesterId: string,
		role: "admin" | "user",
	) {
		if (role !== "admin" && remision.ownerId !== requesterId) {
			throw new ForbiddenError("No tienes acceso a esta remisión");
		}
	}
}
