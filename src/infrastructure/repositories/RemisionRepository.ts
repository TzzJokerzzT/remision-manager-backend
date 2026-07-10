import type { Remision } from "../../domain/entities/Remision.js";
import type { IRemisionRepository } from "../../domain/repositories/IRemisionRepository.js";
import {
	type RemisionDocument,
	RemisionModel,
} from "../database/models/Remision.model.js";

function toDomain(doc: RemisionDocument): Remision {
	return {
		id: doc.id.toString(),
		consecutive: doc.consecutive,
		type: doc.type,
		companyId: doc.companyId.toString(),
		clientId: doc.clientId.toString(),
		driverId: doc.driverId?.toString(),
		items: doc.items,
		subtotal: doc.subtotal,
		ivaPercentage: doc.ivaPercentage,
		ivaValue: doc.ivaValue,
		total: doc.total,
		notes: doc.notes,
		ownerId: doc.ownerId.toString(),
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	};
}

export class RemisionRepository implements IRemisionRepository {
	async create(
		data: Omit<Remision, "id" | "createdAt" | "updatedAt">,
	): Promise<Remision> {
		const doc = await RemisionModel.create(data);
		return toDomain(doc);
	}

	async findById(id: string): Promise<Remision | null> {
		const doc = await RemisionModel.findById(id);
		return doc ? toDomain(doc) : null;
	}

	async update(id: string, data: Partial<Remision>): Promise<Remision | null> {
		const doc = await RemisionModel.findByIdAndUpdate(id, data, {
			new: true,
			runValidators: true,
		});
		return doc ? toDomain(doc) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await RemisionModel.findByIdAndDelete(id);
		return !!result;
	}

	async listByOwner(
		ownerId: string,
		companyId?: string,
		search?: string,
	): Promise<Remision[]> {
		const filter: Record<string, unknown> = { ownerId };
		if (companyId) filter.companyId = companyId;
		if (search && search.trim().length > 0) {
			filter.$text = { $search: search.trim() };
		}
		const query = RemisionModel.find(filter);
		if (search && search.trim().length > 0) {
			query.select({ score: { $meta: "textScore" } });
			query.sort({ score: { $meta: "textScore" } });
		} else {
			query.sort({ createdAt: -1 });
		}
		const docs = await query;
		return docs.map(toDomain);
	}

	async getNextConsecutive(companyId: string): Promise<number> {
		const last = await RemisionModel.findOne({ companyId })
			.sort({ consecutive: -1 })
			.select("consecutive");
		return (last?.consecutive ?? 0) + 1;
	}
}
