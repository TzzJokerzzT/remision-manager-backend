import type { Client } from "../entities/Client.js";

export interface IClientRepository {
	create(data: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<Client>;
	findById(id: string): Promise<Client | null>;
	findByIds(ids: string[]): Promise<Client[]>;
	findIdsByName(name: string): Promise<string[]>;
	update(id: string, data: Partial<Client>): Promise<Client | null>;
	delete(id: string): Promise<boolean>;
	listByOwner(
		ownerId: string,
		companyId?: string,
		search?: string,
		pagination?: { limit: number; page: number },
	): Promise<{ items: Client[]; total: number }>;
}
