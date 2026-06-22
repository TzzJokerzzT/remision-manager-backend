import { Driver } from '../entities/Driver.js';

export interface IDriverRepository {
  create(data: Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>): Promise<Driver>;
  findById(id: string): Promise<Driver | null>;
  update(id: string, data: Partial<Driver>): Promise<Driver | null>;
  delete(id: string): Promise<boolean>;
  listByOwner(ownerId: string, companyId?: string, search?: string): Promise<Driver[]>;
}
