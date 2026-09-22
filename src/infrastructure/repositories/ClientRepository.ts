import type { Client } from "../../domain/entities/Client.js";
import type { IClientRepository } from "../../domain/repositories/IClientRepository.js";
import {
	type ClientDocument,
	ClientModel,
} from "../database/models/Client.model.js";
import { escapeRegex } from "../../shared/utils/escape-regex.js";

function toDomain(doc: ClientDocument): Client {
	return {
		id: doc.id.toString(),
		name: doc.name,
		documentId: doc.documentId,
		address: doc.address,
		phone: doc.phone,
		email: doc.email,
		companyId: doc.companyId.toString(),
		ownerId: doc.ownerId.toString(),
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	};
}

export class ClientRepository implements IClientRepository {
	async create(
		data: Omit<Client, "id" | "createdAt" | "updatedAt">,
	): Promise<Client> {
		const doc = await ClientModel.create(data);
		return toDomain(doc);
	}

	async findById(id: string): Promise<Client | null> {
		const doc = await ClientModel.findById(id);
		return doc ? toDomain(doc) : null;
	}

	async findByIds(ids: string[]): Promise<Client[]> {
		if (ids.length === 0) return [];
		const docs = await ClientModel.find({ _id: { $in: ids } });
		return docs.map(toDomain);
	}

	async findIdsByName(name: string): Promise<string[]> {
		const trimmed = name.trim();
		if (trimmed.length === 0) return [];
		const docs = await ClientModel.find({
			name: { $regex: escapeRegex(trimmed), $options: "i" },
		}).select("_id");
		return docs.map((doc) => doc.id.toString());
	}

	async update(id: string, data: Partial<Client>): Promise<Client | null> {
		const doc = await ClientModel.findByIdAndUpdate(id, data, {
			new: true,
			runValidators: true,
		});
		return doc ? toDomain(doc) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await ClientModel.findByIdAndDelete(id);
		return !!result;
	}

	async listByOwner(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination: { limit: number; page: number } = { limit: 20, page: 1 },
	): Promise<{ items: Client[]; total: number }> {
		const filter: Record<string, unknown> = { ownerId };
		if (companyId) filter.companyId = companyId;
		if (search && search.trim().length > 0) {
			filter.$text = { $search: search.trim() };
		}
		const query = ClientModel.find(filter);
		if (search && search.trim().length > 0) {
			query.select({ score: { $meta: "textScore" } });
			query.sort({ score: { $meta: "textScore" } });
		}
		const skip = (pagination.page - 1) * pagination.limit;
		const [docs, total] = await Promise.all([
			query.skip(skip).limit(pagination.limit),
			ClientModel.countDocuments(filter),
		]);
		return { items: docs.map(toDomain), total };
	}
}
