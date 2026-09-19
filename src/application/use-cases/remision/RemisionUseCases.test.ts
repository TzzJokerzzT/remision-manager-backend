// Co-located unit tests for RemisionUseCases.listMine pagination wiring.
// Conventions: fake repositories (no mongoose), relative imports with .js
// extension, no process.env/network/timers/filesystem.
import { describe, expect, test, vi } from "bun:test";
import type { Remision } from "../../../domain/entities/Remision.js";
import type { ICompanyRepository } from "../../../domain/repositories/ICompanyRepository.js";
import type { IRemisionRepository } from "../../../domain/repositories/IRemisionRepository.js";
import { RemisionUseCases } from "./RemisionUseCases.js";

const createdAt = new Date("2024-01-01T00:00:00Z");
const updatedAt = new Date("2024-01-02T00:00:00Z");

function makeRemision(id: string): Remision {
	return {
		id,
		consecutive: 1,
		type: "priced",
		companyId: "comp1",
		clientId: "cli1",
		driverId: "drv1",
		items: [{ description: "Item", quantity: 2, unitPrice: 10 }],
		subtotal: 20,
		ivaPercentage: 19,
		ivaValue: 3.8,
		total: 23.8,
		notes: "nota",
		ownerId: "owner1",
		createdAt,
		updatedAt,
	};
}

describe("RemisionUseCases.listMine", () => {
	test("returns a PaginationResponseDTO with limit, page, and totalPages", async () => {
		const listByOwner = vi.fn().mockResolvedValue({
			items: [makeRemision("id1"), makeRemision("id2")],
			total: 45,
		});
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
		);

		const result = await useCases.listMine("owner1", "comp1", undefined, {
			limit: 20,
			page: 2,
		});

		expect(result.items).toHaveLength(2);
		expect(result.total).toBe(45);
		expect(result.limit).toBe(20);
		expect(result.page).toBe(2);
		expect(result.totalPages).toBe(3);
		expect(listByOwner).toHaveBeenCalledWith("owner1", "comp1", undefined, {
			limit: 20,
			page: 2,
		});
	});

	test("defaults pagination to limit 20 and page 1", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
		);

		const result = await useCases.listMine("owner1");

		expect(result.limit).toBe(20);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(0);
		expect(listByOwner).toHaveBeenCalledWith("owner1", undefined, undefined, {
			limit: 20,
			page: 1,
		});
	});
});
