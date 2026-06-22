import { IDriverRepository } from '../../../domain/repositories/IDriverRepository.js';
import { ICompanyRepository } from '../../../domain/repositories/ICompanyRepository.js';
import { Driver } from '../../../domain/entities/Driver.js';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError.js';
import { CreateDriverDto, UpdateDriverDto } from '../../dtos/driver.dto.js';

export class DriverUseCases {
  constructor(
    private readonly driverRepo: IDriverRepository,
    private readonly companyRepo: ICompanyRepository
  ) {}

  async create(dto: CreateDriverDto, ownerId: string, role: 'admin' | 'user'): Promise<Driver> {
    const company = await this.companyRepo.findById(dto.companyId);
    if (!company) throw new NotFoundError('Empresa');
    if (role !== 'admin' && company.ownerId !== ownerId) {
      throw new ForbiddenError('No tienes acceso a esta empresa');
    }
    return this.driverRepo.create({ ...dto, ownerId });
  }

  async getById(id: string, requesterId: string, role: 'admin' | 'user'): Promise<Driver> {
    const driver = await this.driverRepo.findById(id);
    if (!driver) throw new NotFoundError('Conductor');
    this.assertOwnership(driver, requesterId, role);
    return driver;
  }

  async listMine(ownerId: string, companyId?: string, search?: string): Promise<Driver[]> {
    return this.driverRepo.listByOwner(ownerId, companyId, search);
  }

  async update(id: string, dto: UpdateDriverDto, requesterId: string, role: 'admin' | 'user'): Promise<Driver> {
    const driver = await this.driverRepo.findById(id);
    if (!driver) throw new NotFoundError('Conductor');
    this.assertOwnership(driver, requesterId, role);
    const updated = await this.driverRepo.update(id, dto);
    if (!updated) throw new NotFoundError('Conductor');
    return updated;
  }

  async delete(id: string, requesterId: string, role: 'admin' | 'user'): Promise<void> {
    const driver = await this.driverRepo.findById(id);
    if (!driver) throw new NotFoundError('Conductor');
    this.assertOwnership(driver, requesterId, role);
    await this.driverRepo.delete(id);
  }

  private assertOwnership(driver: Driver, requesterId: string, role: 'admin' | 'user') {
    if (role !== 'admin' && driver.ownerId !== requesterId) {
      throw new ForbiddenError('No tienes acceso a este conductor');
    }
  }
}
