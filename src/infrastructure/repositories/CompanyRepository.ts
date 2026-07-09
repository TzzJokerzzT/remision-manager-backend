import type { Company } from "../../domain/entities/Company.js";
import type { ICompanyRepository } from "../../domain/repositories/ICompanyRepository.js";
import {
	type CompanyDocument,
	CompanyModel,
} from "../database/models/Company.model.js";

function toDomain(doc: CompanyDocument): Company {
	return {
		id: doc.id.toString(),
		name: doc.name,
		nit: doc.nit,
		address: doc.address,
		phone: doc.phone,
		email: doc.email,
		logoUrl: doc.logoUrl ?? null,
		ownerId: doc.ownerId.toString(),
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	};
}

export class CompanyRepository implements ICompanyRepository {
	async create(
		data: Omit<Company, "id" | "createdAt" | "updatedAt">,
	): Promise<Company> {
		const doc = await CompanyModel.create(data);
		return toDomain(doc);
	}

	async findById(id: string): Promise<Company | null> {
		const doc = await CompanyModel.findById(id);
		return doc ? toDomain(doc) : null;
	}

	async findByNit(nit: string): Promise<Company | null> {
		const doc = await CompanyModel.findOne({ nit });
		return doc ? toDomain(doc) : null;
	}

	async update(id: string, data: Partial<Company>): Promise<Company | null> {
		const doc = await CompanyModel.findByIdAndUpdate(id, data, {
			new: true,
			runValidators: true,
		});
		return doc ? toDomain(doc) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await CompanyModel.findByIdAndDelete(id);
		return !!result;
	}

	async listByOwner(ownerId: string, search?: string): Promise<Company[]> {
		const filter: Record<string, unknown> = { ownerId };
		if (search && search.trim().length > 0) {
			filter.$text = { $search: search.trim() };
		}
		const query = CompanyModel.find(filter);
		if (search && search.trim().length > 0) {
			query.select({ score: { $meta: "textScore" } });
			query.sort({ score: { $meta: "textScore" } });
		}
		const docs = await query;
		return docs.map(toDomain);
	}
}
