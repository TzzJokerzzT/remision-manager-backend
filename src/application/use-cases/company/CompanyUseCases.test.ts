// Co-located unit tests for CompanyUseCases.listMine pagination wiring.
// Conventions: fake repositories (no mongoose), relative imports with .js
// extension, no process.env/network/timers/filesystem.
import { describe, expect, test, vi } from "bun:test";
import type { Company } from "@/domain/entities/Company.js";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository.js";
import { CompanyUseCases } from "@/application/use-cases/company/CompanyUseCases.js";

const createdAt = new Date("2024-01-01T00:00:00Z");
const updatedAt = new Date("2024-01-02T00:00:00Z");

function makeCompany(id: string): Company {
	return {
		id,
		name: "Acme",
		nit: "900123456",
		address: "Calle 1",
		phone: "3001234567",
		email: "acme@correo.com",
		logoUrl: null,
		ownerId: "owner1",
		createdAt,
		updatedAt,
	};
}

describe("CompanyUseCases.listMine", () => {
	test("returns a PaginationResponseDTO with limit, page, and totalPages", async () => {
		const listByOwner = vi.fn().mockResolvedValue({
			items: [makeCompany("id1"), makeCompany("id2")],
			total: 45,
		});
		const companyRepo = { listByOwner } as unknown as ICompanyRepository;
		const useCases = new CompanyUseCases(companyRepo);

		const result = await useCases.listMine("owner1", undefined, {
			limit: 20,
			page: 2,
		});

		expect(result.items).toHaveLength(2);
		expect(result.total).toBe(45);
		expect(result.limit).toBe(20);
		expect(result.page).toBe(2);
		expect(result.totalPages).toBe(3);
		expect(listByOwner).toHaveBeenCalledWith("owner1", undefined, {
			limit: 20,
			page: 2,
		});
	});

	test("defaults pagination to limit 20 and page 1", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const companyRepo = { listByOwner } as unknown as ICompanyRepository;
		const useCases = new CompanyUseCases(companyRepo);

		const result = await useCases.listMine("owner1");

		expect(result.limit).toBe(20);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(0);
		expect(listByOwner).toHaveBeenCalledWith("owner1", undefined, {
			limit: 20,
			page: 1,
		});
	});
});
