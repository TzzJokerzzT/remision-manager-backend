import type { Remision } from "@/domain/entities/Remision.js";
import type {
	IRemisionRepository,
	RemisionListFilters,
} from "@/domain/repositories/IRemisionRepository.js";
import {
	type RemisionDocument,
	RemisionModel,
} from "@/infrastructure/database/models/Remision.model.js";

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
		filters: RemisionListFilters = {},
		pagination: { limit: number; page: number } = { limit: 20, page: 1 },
	): Promise<{ items: Remision[]; total: number }> {
		const { companyId, search, clientIds, driverIds, type, from, to } = filters;
		const filter: Record<string, unknown> = { ownerId };
		if (companyId) filter.companyId = companyId;
		if (search && search.trim().length > 0) {
			filter.$text = { $search: search.trim() };
		}
		// CRITICAL: guard on `!== undefined`, NOT `length > 0`. An empty array
		// means "no name match" and MUST produce `$in: []` (matches nothing).
		if (clientIds !== undefined) filter.clientId = { $in: clientIds };
		if (driverIds !== undefined) filter.driverId = { $in: driverIds };
		if (type !== undefined) filter.type = type;
		if (from !== undefined || to !== undefined) {
			const createdAt: { $gte?: Date; $lte?: Date } = {};
			if (from !== undefined) createdAt.$gte = from;
			if (to !== undefined) createdAt.$lte = to;
			filter.createdAt = createdAt;
		}
		const query = RemisionModel.find(filter);
		if (search && search.trim().length > 0) {
			query.select({ score: { $meta: "textScore" } });
			query.sort({ score: { $meta: "textScore" } });
		} else {
			query.sort({ createdAt: -1 });
		}
		const skip = (pagination.page - 1) * pagination.limit;
		const [docs, total] = await Promise.all([
			query.skip(skip).limit(pagination.limit),
			RemisionModel.countDocuments(filter),
		]);
		return { items: docs.map(toDomain), total };
	}

	async getNextConsecutive(companyId: string): Promise<number> {
		const last = await RemisionModel.findOne({ companyId })
			.sort({ consecutive: -1 })
			.select("consecutive");
		return (last?.consecutive ?? 0) + 1;
	}
}
