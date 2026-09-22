// Co-located unit tests for DriverUseCases.listMine pagination wiring.
// Conventions: fake repositories (no mongoose), relative imports with .js
// extension, no process.env/network/timers/filesystem.
import { describe, expect, test, vi } from "bun:test";
import type { Driver } from "../../../domain/entities/Driver.js";
import type { ICompanyRepository } from "../../../domain/repositories/ICompanyRepository.js";
import type { IDriverRepository } from "../../../domain/repositories/IDriverRepository.js";
import { DriverUseCases } from "./DriverUseCases.js";

const createdAt = new Date("2024-01-01T00:00:00Z");
const updatedAt = new Date("2024-01-02T00:00:00Z");

function makeDriver(id: string): Driver {
	return {
		id,
		name: "Pedro",
		documentId: "54321",
		licenseNumber: "LIC-123",
		phone: "3105554433",
		vehiclePlate: "ABC123",
		companyId: "comp1",
		ownerId: "owner1",
		createdAt,
		updatedAt,
	};
}

describe("DriverUseCases.listMine", () => {
	test("returns a PaginationResponseDTO with limit, page, and totalPages", async () => {
		const listByOwner = vi.fn().mockResolvedValue({
			items: [makeDriver("id1"), makeDriver("id2")],
			total: 45,
		});
		const driverRepo = { listByOwner } as unknown as IDriverRepository;
		const useCases = new DriverUseCases(driverRepo, {} as ICompanyRepository);

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
		const driverRepo = { listByOwner } as unknown as IDriverRepository;
		const useCases = new DriverUseCases(driverRepo, {} as ICompanyRepository);

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
