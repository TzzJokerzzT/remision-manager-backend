import type { Company } from "../../../domain/entities/Company.js";
import type { ICompanyRepository } from "../../../domain/repositories/ICompanyRepository.js";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../../shared/errors/AppError.js";
import type {
	CreateCompanyDto,
	UpdateCompanyDto,
} from "../../dtos/company.dto.js";
import {
	buildPaginationResponse,
	type PaginationDTO,
	type PaginationResponseDTO,
} from "../../dtos/pagination.dto.js";

export class CompanyUseCases {
	constructor(private readonly companyRepo: ICompanyRepository) {}

	async create(dto: CreateCompanyDto, ownerId: string): Promise<Company> {
		const existing = await this.companyRepo.findByNit(dto.nit);
		if (existing) throw new ConflictError("Ya existe una empresa con ese NIT");
		return this.companyRepo.create({
			...dto,
			ownerId,
			logoUrl: dto.logoUrl ?? null,
		});
	}

	async getById(
		id: string,
		requesterId: string,
		role: "admin" | "user",
	): Promise<Company> {
		const company = await this.companyRepo.findById(id);
		if (!company) throw new NotFoundError("Empresa");
		this.assertOwnership(company, requesterId, role);
		return company;
	}

	async listMine(
		ownerId: string,
		search?: string,
		pagination: PaginationDTO = { limit: 20, page: 1 },
	): Promise<PaginationResponseDTO<Company>> {
		const { items, total } = await this.companyRepo.listByOwner(
			ownerId,
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
		dto: UpdateCompanyDto,
		requesterId: string,
		role: "admin" | "user",
	): Promise<Company> {
		const company = await this.companyRepo.findById(id);
		if (!company) throw new NotFoundError("Empresa");
		this.assertOwnership(company, requesterId, role);
		const updated = await this.companyRepo.update(id, dto);
		if (!updated) throw new NotFoundError("Empresa");
		return updated;
	}

	async delete(
		id: string,
		requesterId: string,
		role: "admin" | "user",
	): Promise<void> {
		const company = await this.companyRepo.findById(id);
		if (!company) throw new NotFoundError("Empresa");
		this.assertOwnership(company, requesterId, role);
		await this.companyRepo.delete(id);
	}

	private assertOwnership(
		company: Company,
		requesterId: string,
		role: "admin" | "user",
	) {
		if (role !== "admin" && company.ownerId !== requesterId) {
			throw new ForbiddenError("No tienes acceso a esta empresa");
		}
	}
}
