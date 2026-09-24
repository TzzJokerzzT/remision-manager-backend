import type { Remision } from "../../../domain/entities/Remision.js";
import type { IClientRepository } from "../../../domain/repositories/IClientRepository.js";
import type { ICompanyRepository } from "../../../domain/repositories/ICompanyRepository.js";
import type { IDriverRepository } from "../../../domain/repositories/IDriverRepository.js";
import type {
	IRemisionRepository,
	RemisionListFilters,
} from "../../../domain/repositories/IRemisionRepository.js";
import { computeRemisionTotals } from "../../../domain/services/remisionTotals.js";
import {
	ForbiddenError,
	NotFoundError,
} from "../../../shared/errors/AppError.js";
import {
	buildPaginationResponse,
	type PaginationResponseDTO,
} from "../../dtos/pagination.dto.js";
import type {
	CreateRemisionDto,
	UpdateRemisionDto,
} from "../../dtos/remision.dto.js";
import type { RemisionListQueryDTO } from "../../dtos/remision-list-query.dto.js";

export type RemisionWithClient = Remision & { clientName: string };

export class RemisionUseCases {
	constructor(
		private readonly remisionRepo: IRemisionRepository,
		private readonly companyRepo: ICompanyRepository,
		private readonly clientRepo: IClientRepository,
		private readonly driverRepo: IDriverRepository,
	) {}

	async create(
		dto: CreateRemisionDto,
		ownerId: string,
		role: "admin" | "user",
	): Promise<RemisionWithClient> {
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
			dto.hasRetencion,
			dto.retencionPercentage,
		);

		const created = await this.remisionRepo.create({
			...dto,
			consecutive,
			ownerId,
			...totals,
		});
		const client = await this.clientRepo.findById(dto.clientId);
		return { ...created, clientName: client?.name ?? "" };
	}

	async getById(
		id: string,
		requesterId: string,
		role: "admin" | "user",
	): Promise<RemisionWithClient> {
		const remision = await this.remisionRepo.findById(id);
		if (!remision) throw new NotFoundError("Remisión");
		this.assertOwnership(remision, requesterId, role);
		const client = await this.clientRepo.findById(remision.clientId);
		return { ...remision, clientName: client?.name ?? "" };
	}

	async listMine(
		ownerId: string,
		query: Partial<RemisionListQueryDTO> = {},
	): Promise<PaginationResponseDTO<RemisionWithClient>> {
		const {
			companyId,
			search,
			clientName,
			driverName,
			type,
			from,
			to,
			limit = 20,
			page = 1,
		} = query;

		// Resolve names → ids. `undefined` = "filter not supplied";
		// `[]` = "supplied but no matches" (⇒ `$in: []` ⇒ empty result).
		const clientIds =
			clientName !== undefined
				? await this.clientRepo.findIdsByName(clientName)
				: undefined;
		const driverIds =
			driverName !== undefined
				? await this.driverRepo.findIdsByName(driverName)
				: undefined;

		const filters: RemisionListFilters = {
			companyId,
			search,
			clientIds,
			driverIds,
			type,
			from,
			to,
		};
		const { items, total } = await this.remisionRepo.listByOwner(
			ownerId,
			filters,
			{ limit, page },
		);

		// Unchanged enrichment path.
		const clientIdsSet = [...new Set(items.map((i) => i.clientId))];
		const clients = await this.clientRepo.findByIds(clientIdsSet);
		const nameById = new Map(clients.map((c) => [c.id, c.name]));
		const enriched = items.map((item) => ({
			...item,
			clientName: nameById.get(item.clientId) ?? "",
		}));
		return buildPaginationResponse(enriched, total, limit, page);
	}

	async update(
		id: string,
		dto: UpdateRemisionDto,
		requesterId: string,
		role: "admin" | "user",
	): Promise<RemisionWithClient> {
		const remision = await this.remisionRepo.findById(id);
		if (!remision) throw new NotFoundError("Remisión");
		this.assertOwnership(remision, requesterId, role);

		const items = dto.items ?? remision.items;
		const ivaPercentage = dto.ivaPercentage ?? remision.ivaPercentage;
		const hasRetencion = dto.hasRetencion ?? remision.hasRetencion;
		const retencionPercentage =
			dto.retencionPercentage ?? remision.retencionPercentage;
		const totals = computeRemisionTotals(
			items,
			remision.type,
			ivaPercentage,
			hasRetencion,
			retencionPercentage,
		);

		const updated = await this.remisionRepo.update(id, { ...dto, ...totals });
		if (!updated) throw new NotFoundError("Remisión");
		const client = await this.clientRepo.findById(remision.clientId);
		return { ...updated, clientName: client?.name ?? "" };
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
