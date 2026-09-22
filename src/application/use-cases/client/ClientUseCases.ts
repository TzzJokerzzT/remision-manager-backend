import type {
	CreateClientDto,
	UpdateClientDto,
} from "@/application/dtos/client.dto.js";
import {
	buildPaginationResponse,
	type PaginationDTO,
	type PaginationResponseDTO,
} from "@/application/dtos/pagination.dto.js";
import type { Client } from "@/domain/entities/Client.js";
import type { IClientRepository } from "@/domain/repositories/IClientRepository.js";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository.js";
import { ForbiddenError, NotFoundError } from "@/shared/errors/AppError.js";

export class ClientUseCases {
	constructor(
		private readonly clientRepo: IClientRepository,
		private readonly companyRepo: ICompanyRepository,
	) {}

	async create(
		dto: CreateClientDto,
		ownerId: string,
		role: "admin" | "user",
	): Promise<Client> {
		const company = await this.companyRepo.findById(dto.companyId);
		if (!company) throw new NotFoundError("Empresa");
		if (role !== "admin" && company.ownerId !== ownerId) {
			throw new ForbiddenError("No tienes acceso a esta empresa");
		}
		return this.clientRepo.create({ ...dto, ownerId });
	}

	async getById(
		id: string,
		requesterId: string,
		role: "admin" | "user",
	): Promise<Client> {
		const client = await this.clientRepo.findById(id);
		if (!client) throw new NotFoundError("Cliente");
		this.assertOwnership(client, requesterId, role);
		return client;
	}

	async listMine(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination: PaginationDTO = { limit: 20, page: 1 },
	): Promise<PaginationResponseDTO<Client>> {
		const { items, total } = await this.clientRepo.listByOwner(
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
		dto: UpdateClientDto,
		requesterId: string,
		role: "admin" | "user",
	): Promise<Client> {
		const client = await this.clientRepo.findById(id);
		if (!client) throw new NotFoundError("Cliente");
		this.assertOwnership(client, requesterId, role);
		const updated = await this.clientRepo.update(id, dto);
		if (!updated) throw new NotFoundError("Cliente");
		return updated;
	}

	async delete(
		id: string,
		requesterId: string,
		role: "admin" | "user",
	): Promise<void> {
		const client = await this.clientRepo.findById(id);
		if (!client) throw new NotFoundError("Cliente");
		this.assertOwnership(client, requesterId, role);
		await this.clientRepo.delete(id);
	}

	private assertOwnership(
		client: Client,
		requesterId: string,
		role: "admin" | "user",
	) {
		if (role !== "admin" && client.ownerId !== requesterId) {
			throw new ForbiddenError("No tienes acceso a este cliente");
		}
	}
}
