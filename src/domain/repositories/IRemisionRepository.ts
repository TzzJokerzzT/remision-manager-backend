import { Remision } from '../entities/Remision.js';

export interface IRemisionRepository {
  create(data: Omit<Remision, 'id' | 'createdAt' | 'updatedAt'>): Promise<Remision>;
  findById(id: string): Promise<Remision | null>;
  update(id: string, data: Partial<Remision>): Promise<Remision | null>;
  delete(id: string): Promise<boolean>;
  listByOwner(ownerId: string, companyId?: string): Promise<Remision[]>;
  getNextConsecutive(companyId: string): Promise<number>;
}
