import type { Remision } from "../entities/Remision.js";

export interface RemisionListFilters {
	companyId?: string;
	search?: string;
	clientIds?: string[];
	driverIds?: string[];
	type?: Remision["type"];
	from?: Date;
	to?: Date;
}

export interface IRemisionRepository {
	create(
		data: Omit<Remision, "id" | "createdAt" | "updatedAt">,
	): Promise<Remision>;
	findById(id: string): Promise<Remision | null>;
	update(id: string, data: Partial<Remision>): Promise<Remision | null>;
	delete(id: string): Promise<boolean>;
	listByOwner(
		ownerId: string,
		filters?: RemisionListFilters,
		pagination?: { limit: number; page: number },
	): Promise<{ items: Remision[]; total: number }>;
	getNextConsecutive(companyId: string): Promise<number>;
}
