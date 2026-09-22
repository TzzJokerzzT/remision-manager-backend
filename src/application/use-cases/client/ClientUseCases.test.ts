// Co-located unit tests for ClientUseCases.listMine pagination wiring.
// Conventions: fake repositories (no mongoose), relative imports with .js
// extension, no process.env/network/timers/filesystem.
import { describe, expect, test, vi } from "bun:test";
import { ClientUseCases } from "@/application/use-cases/client/ClientUseCases.js";
import type { Client } from "@/domain/entities/Client.js";
import type { IClientRepository } from "@/domain/repositories/IClientRepository.js";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository.js";

const createdAt = new Date("2024-01-01T00:00:00Z");
const updatedAt = new Date("2024-01-02T00:00:00Z");

function makeClient(id: string): Client {
	return {
		id,
		name: "Juan",
		documentId: "12345",
		address: "Calle 2",
		phone: "3009998877",
		email: "juan@correo.com",
		companyId: "comp1",
		ownerId: "owner1",
		createdAt,
		updatedAt,
	};
}

describe("ClientUseCases.listMine", () => {
	test("returns a PaginationResponseDTO with limit, page, and totalPages", async () => {
		const listByOwner = vi.fn().mockResolvedValue({
			items: [makeClient("id1"), makeClient("id2")],
			total: 45,
		});
		const clientRepo = { listByOwner } as unknown as IClientRepository;
		const useCases = new ClientUseCases(clientRepo, {} as ICompanyRepository);

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
		const clientRepo = { listByOwner } as unknown as IClientRepository;
		const useCases = new ClientUseCases(clientRepo, {} as ICompanyRepository);

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
