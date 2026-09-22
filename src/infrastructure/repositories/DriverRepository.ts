import type { Driver } from "@/domain/entities/Driver.js";
import type { IDriverRepository } from "@/domain/repositories/IDriverRepository.js";
import {
	type DriverDocument,
	DriverModel,
} from "@/infrastructure/database/models/Driver.model.js";
import { escapeRegex } from "@/shared/utils/escape-regex.js";

function toDomain(doc: DriverDocument): Driver {
	return {
		id: doc.id.toString(),
		name: doc.name,
		documentId: doc.documentId,
		licenseNumber: doc.licenseNumber,
		phone: doc.phone,
		vehiclePlate: doc.vehiclePlate,
		companyId: doc.companyId.toString(),
		ownerId: doc.ownerId.toString(),
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	};
}

export class DriverRepository implements IDriverRepository {
	async create(
		data: Omit<Driver, "id" | "createdAt" | "updatedAt">,
	): Promise<Driver> {
		const doc = await DriverModel.create(data);
		return toDomain(doc);
	}

	async findById(id: string): Promise<Driver | null> {
		const doc = await DriverModel.findById(id);
		return doc ? toDomain(doc) : null;
	}

	async findIdsByName(name: string): Promise<string[]> {
		const trimmed = name.trim();
		if (trimmed.length === 0) return [];
		const docs = await DriverModel.find({
			name: { $regex: escapeRegex(trimmed), $options: "i" },
		}).select("_id");
		return docs.map((doc) => doc.id.toString());
	}

	async update(id: string, data: Partial<Driver>): Promise<Driver | null> {
		const doc = await DriverModel.findByIdAndUpdate(id, data, {
			new: true,
			runValidators: true,
		});
		return doc ? toDomain(doc) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await DriverModel.findByIdAndDelete(id);
		return !!result;
	}

	async listByOwner(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination: { limit: number; page: number } = { limit: 20, page: 1 },
	): Promise<{ items: Driver[]; total: number }> {
		const filter: Record<string, unknown> = { ownerId };
		if (companyId) filter.companyId = companyId;
		if (search && search.trim().length > 0) {
			filter.$text = { $search: search.trim() };
		}
		const query = DriverModel.find(filter);
		if (search && search.trim().length > 0) {
			query.select({ score: { $meta: "textScore" } });
			query.sort({ score: { $meta: "textScore" } });
		}
		const skip = (pagination.page - 1) * pagination.limit;
		const [docs, total] = await Promise.all([
			query.skip(skip).limit(pagination.limit),
			DriverModel.countDocuments(filter),
		]);
		return { items: docs.map(toDomain), total };
	}
}
