import { IClientRepository } from '../../domain/repositories/IClientRepository.js';
import { Client } from '../../domain/entities/Client.js';
import { ClientModel, ClientDocument } from '../database/models/Client.model.js';

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
  async create(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const doc = await ClientModel.create(data);
    return toDomain(doc);
  }

  async findById(id: string): Promise<Client | null> {
    const doc = await ClientModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async update(id: string, data: Partial<Client>): Promise<Client | null> {
    const doc = await ClientModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return doc ? toDomain(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ClientModel.findByIdAndDelete(id);
    return !!result;
  }

  async listByOwner(ownerId: string, companyId?: string, search?: string): Promise<Client[]> {
    const filter: Record<string, unknown> = { ownerId };
    if (companyId) filter.companyId = companyId;
    if (search && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }
    const query = ClientModel.find(filter);
    if (search && search.trim().length > 0) {
      query.select({ score: { $meta: 'textScore' } });
      query.sort({ score: { $meta: 'textScore' } });
    }
    const docs = await query;
    return docs.map(toDomain);
  }
}
