import { IClientRepository } from '../../../domain/repositories/IClientRepository.js';
import { ICompanyRepository } from '../../../domain/repositories/ICompanyRepository.js';
import { Client } from '../../../domain/entities/Client.js';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { CreateClientDto, UpdateClientDto } from '../../dtos/client.dto.js';

export class ClientUseCases {
  constructor(
    private readonly clientRepo: IClientRepository,
    private readonly companyRepo: ICompanyRepository
  ) {}

  async create(dto: CreateClientDto, ownerId: string, role: 'admin' | 'user'): Promise<Client> {
    const company = await this.companyRepo.findById(dto.companyId);
    if (!company) throw new NotFoundError('Empresa');
    if (role !== 'admin' && company.ownerId !== ownerId) {
      throw new ForbiddenError('No tienes acceso a esta empresa');
    }
    return this.clientRepo.create({ ...dto, ownerId });
  }

  async getById(id: string, requesterId: string, role: 'admin' | 'user'): Promise<Client> {
    const client = await this.clientRepo.findById(id);
    if (!client) throw new NotFoundError('Cliente');
    this.assertOwnership(client, requesterId, role);
    return client;
  }

  async listMine(ownerId: string, companyId?: string, search?: string): Promise<Client[]> {
    return this.clientRepo.listByOwner(ownerId, companyId, search);
  }

  async update(id: string, dto: UpdateClientDto, requesterId: string, role: 'admin' | 'user'): Promise<Client> {
    const client = await this.clientRepo.findById(id);
    if (!client) throw new NotFoundError('Cliente');
    this.assertOwnership(client, requesterId, role);
    const updated = await this.clientRepo.update(id, dto);
    if (!updated) throw new NotFoundError('Cliente');
    return updated;
  }

  async delete(id: string, requesterId: string, role: 'admin' | 'user'): Promise<void> {
    const client = await this.clientRepo.findById(id);
    if (!client) throw new NotFoundError('Cliente');
    this.assertOwnership(client, requesterId, role);
    await this.clientRepo.delete(id);
  }

  private assertOwnership(client: Client, requesterId: string, role: 'admin' | 'user') {
    if (role !== 'admin' && client.ownerId !== requesterId) {
      throw new ForbiddenError('No tienes acceso a este cliente');
    }
  }
}
