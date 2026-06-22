import { IRemisionRepository } from '../../../domain/repositories/IRemisionRepository.js';
import { ICompanyRepository } from '../../../domain/repositories/ICompanyRepository.js';
import { Remision, RemisionItem } from '../../../domain/entities/Remision.js';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { CreateRemisionDto, UpdateRemisionDto } from '../../dtos/remision.dto.js';

function computeTotals(items: RemisionItem[], type: 'priced' | 'quantity_only', ivaPercentage?: number) {
  if (type === 'quantity_only') {
    return { subtotal: undefined, ivaValue: undefined, total: undefined };
  }
  const subtotal = items.reduce((acc, i) => acc + i.quantity * (i.unitPrice ?? 0), 0);
  const iva = ivaPercentage ?? 0;
  const ivaValue = +(subtotal * (iva / 100)).toFixed(2);
  const total = +(subtotal + ivaValue).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), ivaValue, total };
}

export class RemisionUseCases {
  constructor(
    private readonly remisionRepo: IRemisionRepository,
    private readonly companyRepo: ICompanyRepository
  ) {}

  async create(dto: CreateRemisionDto, ownerId: string, role: 'admin' | 'user'): Promise<Remision> {
    const company = await this.companyRepo.findById(dto.companyId);
    if (!company) throw new NotFoundError('Empresa');
    if (role !== 'admin' && company.ownerId !== ownerId) {
      throw new ForbiddenError('No tienes acceso a esta empresa');
    }

    const consecutive = await this.remisionRepo.getNextConsecutive(dto.companyId);
    const totals = computeTotals(dto.items, dto.type, dto.ivaPercentage);

    return this.remisionRepo.create({
      ...dto,
      consecutive,
      ownerId,
      ...totals,
    });
  }

  async getById(id: string, requesterId: string, role: 'admin' | 'user'): Promise<Remision> {
    const remision = await this.remisionRepo.findById(id);
    if (!remision) throw new NotFoundError('Remisión');
    this.assertOwnership(remision, requesterId, role);
    return remision;
  }

  async listMine(ownerId: string, companyId?: string, search?: string): Promise<Remision[]> {
    return this.remisionRepo.listByOwner(ownerId, companyId, search);
  }

  async update(id: string, dto: UpdateRemisionDto, requesterId: string, role: 'admin' | 'user'): Promise<Remision> {
    const remision = await this.remisionRepo.findById(id);
    if (!remision) throw new NotFoundError('Remisión');
    this.assertOwnership(remision, requesterId, role);

    const items = dto.items ?? remision.items;
    const ivaPercentage = dto.ivaPercentage ?? remision.ivaPercentage;
    const totals = computeTotals(items, remision.type, ivaPercentage);

    const updated = await this.remisionRepo.update(id, { ...dto, ...totals });
    if (!updated) throw new NotFoundError('Remisión');
    return updated;
  }

  async delete(id: string, requesterId: string, role: 'admin' | 'user'): Promise<void> {
    const remision = await this.remisionRepo.findById(id);
    if (!remision) throw new NotFoundError('Remisión');
    this.assertOwnership(remision, requesterId, role);
    await this.remisionRepo.delete(id);
  }

  private assertOwnership(remision: Remision, requesterId: string, role: 'admin' | 'user') {
    if (role !== 'admin' && remision.ownerId !== requesterId) {
      throw new ForbiddenError('No tienes acceso a esta remisión');
    }
  }
}
