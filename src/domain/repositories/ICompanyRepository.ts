import { Company } from '../entities/Company.js';

export interface ICompanyRepository {
  create(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company>;
  findById(id: string): Promise<Company | null>;
  findByNit(nit: string): Promise<Company | null>;
  update(id: string, data: Partial<Company>): Promise<Company | null>;
  delete(id: string): Promise<boolean>;
  listByOwner(ownerId: string): Promise<Company[]>;
}
