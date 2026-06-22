import { IDriverRepository } from '../../domain/repositories/IDriverRepository.js';
import { Driver } from '../../domain/entities/Driver.js';
import { DriverModel, DriverDocument } from '../database/models/Driver.model.js';

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
  async create(data: Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>): Promise<Driver> {
    const doc = await DriverModel.create(data);
    return toDomain(doc);
  }

  async findById(id: string): Promise<Driver | null> {
    const doc = await DriverModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async update(id: string, data: Partial<Driver>): Promise<Driver | null> {
    const doc = await DriverModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return doc ? toDomain(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await DriverModel.findByIdAndDelete(id);
    return !!result;
  }

  async listByOwner(ownerId: string, companyId?: string, search?: string): Promise<Driver[]> {
    const filter: Record<string, unknown> = { ownerId };
    if (companyId) filter.companyId = companyId;
    if (search && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }
    const query = DriverModel.find(filter);
    if (search && search.trim().length > 0) {
      query.select({ score: { $meta: 'textScore' } });
      query.sort({ score: { $meta: 'textScore' } });
    }
    const docs = await query;
    return docs.map(toDomain);
  }
}
