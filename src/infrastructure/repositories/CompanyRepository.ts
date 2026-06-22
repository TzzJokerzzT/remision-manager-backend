import { ICompanyRepository } from '../../domain/repositories/ICompanyRepository.js';
import { Company } from '../../domain/entities/Company.js';
import { CompanyModel, CompanyDocument } from '../database/models/Company.model.js';

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
  async create(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
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
    const doc = await CompanyModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return doc ? toDomain(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await CompanyModel.findByIdAndDelete(id);
    return !!result;
  }

  async listByOwner(ownerId: string): Promise<Company[]> {
    const docs = await CompanyModel.find({ ownerId });
    return docs.map(toDomain);
  }
}
