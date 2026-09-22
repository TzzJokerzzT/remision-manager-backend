import { Driver } from "../entities/Driver.js";

export interface IDriverRepository {
	create(data: Omit<Driver, "id" | "createdAt" | "updatedAt">): Promise<Driver>;
	findById(id: string): Promise<Driver | null>;
	findIdsByName(name: string): Promise<string[]>;
	update(id: string, data: Partial<Driver>): Promise<Driver | null>;
	delete(id: string): Promise<boolean>;
	listByOwner(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination?: { limit: number; page: number },
	): Promise<{ items: Driver[]; total: number }>;
}
