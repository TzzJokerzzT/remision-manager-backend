// Co-located unit tests for RemisionUseCases.listMine pagination wiring.
// Conventions: fake repositories (no mongoose), relative imports with .js
// extension, no process.env/network/timers/filesystem.
import { describe, expect, test, vi } from "bun:test";
import type { Client } from "../../../domain/entities/Client.js";
import type { Remision } from "../../../domain/entities/Remision.js";
import type { IClientRepository } from "../../../domain/repositories/IClientRepository.js";
import type { ICompanyRepository } from "../../../domain/repositories/ICompanyRepository.js";
import type { IDriverRepository } from "../../../domain/repositories/IDriverRepository.js";
import type { IRemisionRepository } from "../../../domain/repositories/IRemisionRepository.js";
import { ValidationError } from "../../../shared/errors/AppError.js";
import { RemisionUseCases } from "./RemisionUseCases.js";

const createdAt = new Date("2024-01-01T00:00:00Z");
const updatedAt = new Date("2024-01-02T00:00:00Z");

function makeRemision(id: string): Remision {
	return {
		id,
		consecutive: 1,
		type: "priced",
		documentType: "remision",
		companyId: "comp1",
		clientId: "cli1",
		driverId: "drv1",
		items: [
			{
				description: "Item",
				quantity: 2,
				unitPrice: 10,
				hasIva: true,
				ivaPercentage: 19,
				ivaValue: 3.8,
			},
		],
		subtotal: 20,
		ivaValue: 3.8,
		hasRetencion: false,
		total: 23.8,
		notes: "nota",
		ownerId: "owner1",
		createdAt,
		updatedAt,
	};
}

function makeClient(id: string, name: string): Client {
	return {
		id,
		name,
		documentId: "123456789",
		companyId: "comp1",
		ownerId: "owner1",
		createdAt,
		updatedAt,
	};
}

function makeCompany(id: string): {
	id: string;
	name: string;
	ownerId: string;
} {
	return {
		id,
		name: "Empresa A",
		ownerId: "owner1",
	};
}

describe("RemisionUseCases.listMine", () => {
	test("returns a PaginationResponseDTO with limit, page, and totalPages", async () => {
		const listByOwner = vi.fn().mockResolvedValue({
			items: [makeRemision("id1"), makeRemision("id2")],
			total: 45,
		});
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = {
			findByIds: vi.fn().mockResolvedValue([]),
		} as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: vi.fn().mockResolvedValue([]),
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		const result = await useCases.listMine("owner1", {
			companyId: "comp1",
			limit: 20,
			page: 2,
		});

		expect(result.items).toHaveLength(2);
		expect(result.total).toBe(45);
		expect(result.limit).toBe(20);
		expect(result.page).toBe(2);
		expect(result.totalPages).toBe(3);
		expect(listByOwner).toHaveBeenCalledWith(
			"owner1",
			expect.objectContaining({ companyId: "comp1" }),
			{ limit: 20, page: 2 },
		);
	});

	test("defaults pagination to limit 20 and page 1", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = {
			findByIds: vi.fn().mockResolvedValue([]),
		} as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: vi.fn().mockResolvedValue([]),
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		const result = await useCases.listMine("owner1");

		expect(result.limit).toBe(20);
		expect(result.page).toBe(1);
		expect(result.totalPages).toBe(0);
		expect(listByOwner).toHaveBeenCalledWith("owner1", expect.anything(), {
			limit: 20,
			page: 1,
		});
	});
});

describe("RemisionUseCases.listMine name resolution", () => {
	test("resolves clientName to clientIds via findIdsByName", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const findIdsByName = vi.fn().mockResolvedValue(["cli1", "cli2"]);
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = {
			findByIds: vi.fn().mockResolvedValue([]),
			findIdsByName,
		} as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: vi.fn().mockResolvedValue([]),
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		await useCases.listMine("owner1", { clientName: "acme" });

		expect(findIdsByName).toHaveBeenCalledWith("acme");
		expect(listByOwner).toHaveBeenCalledWith(
			"owner1",
			expect.objectContaining({ clientIds: ["cli1", "cli2"] }),
			{ limit: 20, page: 1 },
		);
	});

	test("resolves driverName to driverIds via findIdsByName", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const findIdsByName = vi.fn().mockResolvedValue(["drv1"]);
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = {
			findByIds: vi.fn().mockResolvedValue([]),
		} as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName,
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		await useCases.listMine("owner1", { driverName: "carlos" });

		expect(findIdsByName).toHaveBeenCalledWith("carlos");
		expect(listByOwner).toHaveBeenCalledWith(
			"owner1",
			expect.objectContaining({ driverIds: ["drv1"] }),
			{ limit: 20, page: 1 },
		);
	});

	test("skips name resolution when names are absent", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const clientFindIdsByName = vi.fn().mockResolvedValue([]);
		const driverFindIdsByName = vi.fn().mockResolvedValue([]);
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = {
			findByIds: vi.fn().mockResolvedValue([]),
			findIdsByName: clientFindIdsByName,
		} as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: driverFindIdsByName,
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		await useCases.listMine("owner1");

		expect(clientFindIdsByName).not.toHaveBeenCalled();
		expect(driverFindIdsByName).not.toHaveBeenCalled();
		expect(listByOwner).toHaveBeenCalledWith(
			"owner1",
			expect.objectContaining({ clientIds: undefined, driverIds: undefined }),
			{ limit: 20, page: 1 },
		);
	});

	test("forwards type, from, and to filters", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = {
			findByIds: vi.fn().mockResolvedValue([]),
		} as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: vi.fn().mockResolvedValue([]),
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		const from = new Date("2026-01-01T00:00:00Z");
		const to = new Date("2026-01-31T23:59:59.999Z");
		await useCases.listMine("owner1", { type: "priced", from, to });

		expect(listByOwner).toHaveBeenCalledWith(
			"owner1",
			expect.objectContaining({ type: "priced", from, to }),
			{ limit: 20, page: 1 },
		);
	});

	test("composes companyId and search with name filters", async () => {
		const listByOwner = vi.fn().mockResolvedValue({ items: [], total: 0 });
		const findIdsByName = vi.fn().mockResolvedValue(["cli1"]);
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = {
			findByIds: vi.fn().mockResolvedValue([]),
			findIdsByName,
		} as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: vi.fn().mockResolvedValue([]),
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		await useCases.listMine("owner1", {
			companyId: "comp1",
			search: "nota",
			clientName: "acme",
		});

		expect(findIdsByName).toHaveBeenCalledWith("acme");
		expect(listByOwner).toHaveBeenCalledWith(
			"owner1",
			expect.objectContaining({
				companyId: "comp1",
				search: "nota",
				clientIds: ["cli1"],
			}),
			{ limit: 20, page: 1 },
		);
	});
});

describe("RemisionUseCases.listMine clientName enrichment", () => {
	test("maps unique clientIds to clientName via findByIds", async () => {
		const listByOwner = vi.fn().mockResolvedValue({
			items: [makeRemision("id1"), makeRemision("id2")],
			total: 2,
		});
		const findByIds = vi
			.fn()
			.mockResolvedValue([makeClient("cli1", "Cliente A")]);
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = { findByIds } as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: vi.fn().mockResolvedValue([]),
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		const result = await useCases.listMine("owner1");

		expect(result.items[0].clientName).toBe("Cliente A");
		expect(result.items[1].clientName).toBe("Cliente A");
		expect(findByIds).toHaveBeenCalledWith(["cli1"]);
	});

	test("clientName is empty string when client is missing", async () => {
		const listByOwner = vi.fn().mockResolvedValue({
			items: [makeRemision("id1")],
			total: 1,
		});
		const findByIds = vi.fn().mockResolvedValue([]);
		const remisionRepo = { listByOwner } as unknown as IRemisionRepository;
		const clientRepo = { findByIds } as unknown as IClientRepository;
		const driverRepo = {
			findIdsByName: vi.fn().mockResolvedValue([]),
		} as unknown as IDriverRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			driverRepo,
		);

		const result = await useCases.listMine("owner1");

		expect(result.items[0].clientName).toBe("");
	});
});

describe("RemisionUseCases.getById", () => {
	test("returns clientName from clientRepo.findById", async () => {
		const findById = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = { findById } as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		const result = await useCases.getById("id1", "owner1", "admin");

		expect(result.clientName).toBe("Cliente A");
	});

	test("clientName is empty string when client is null", async () => {
		const findById = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = { findById } as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(null),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		const result = await useCases.getById("id1", "owner1", "admin");

		expect(result.clientName).toBe("");
	});
});

describe("RemisionUseCases.create", () => {
	test("returns clientName from the fetched client", async () => {
		const getNextConsecutive = vi.fn().mockResolvedValue(1);
		const create = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = {
			getNextConsecutive,
			create,
		} as unknown as IRemisionRepository;
		const companyRepo = {
			findById: vi.fn().mockResolvedValue(makeCompany("comp1")),
		} as unknown as ICompanyRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			companyRepo,
			clientRepo,
			{} as IDriverRepository,
		);

		const result = await useCases.create(
			{
				type: "priced",
				documentType: "remision",
				companyId: "comp1",
				clientId: "cli1",
				driverId: "drv1",
				items: [
					{
						description: "Item",
						quantity: 2,
						unitPrice: 10,
						hasIva: true,
						ivaPercentage: 19,
					},
				],
				hasRetencion: false,
			},
			"owner1",
			"admin",
		);

		expect(result.clientName).toBe("Cliente A");
	});

	test("persists items enriched with per-item ivaValue", async () => {
		const getNextConsecutive = vi.fn().mockResolvedValue(1);
		const create = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = {
			getNextConsecutive,
			create,
		} as unknown as IRemisionRepository;
		const companyRepo = {
			findById: vi.fn().mockResolvedValue(makeCompany("comp1")),
		} as unknown as ICompanyRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			companyRepo,
			clientRepo,
			{} as IDriverRepository,
		);

		await useCases.create(
			{
				type: "priced",
				documentType: "remision",
				companyId: "comp1",
				clientId: "cli1",
				items: [
					{
						description: "A",
						quantity: 1,
						unitPrice: 100,
						hasIva: true,
						ivaPercentage: 19,
					},
					{
						description: "B",
						quantity: 1,
						unitPrice: 100,
						hasIva: false,
					},
				],
				hasRetencion: false,
			},
			"owner1",
			"admin",
		);

		const payload = create.mock.calls[0][0] as Record<string, unknown>;
		const items = payload.items as Array<Record<string, unknown>>;
		expect(items[0].ivaValue).toBe(19);
		expect(items[1].ivaValue).toBeUndefined();
		expect(payload.ivaValue).toBe(19);
		expect(payload.subtotal).toBe(200);
		expect(payload.total).toBe(219);
	});

	test("a rejected create does not consume a consecutive number", async () => {
		const getNextConsecutive = vi.fn().mockResolvedValue(1);
		const create = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = {
			getNextConsecutive,
			create,
		} as unknown as IRemisionRepository;
		const companyRepo = {
			findById: vi.fn().mockResolvedValue(makeCompany("comp1")),
		} as unknown as ICompanyRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			companyRepo,
			clientRepo,
			{} as IDriverRepository,
		);

		let caught: unknown;
		try {
			await useCases.create(
				{
					type: "priced",
					documentType: "remision",
					companyId: "comp1",
					clientId: "cli1",
					items: [
						{
							description: "Item",
							quantity: 2,
							unitPrice: 10,
							hasIva: true,
							ivaPercentage: 19,
						},
					],
					ivaValue: 999,
					hasRetencion: false,
				},
				"owner1",
				"admin",
			);
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect(getNextConsecutive).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	test("rejects a sent ivaValue that does not match the derived sum", async () => {
		const getNextConsecutive = vi.fn().mockResolvedValue(1);
		const create = vi.fn();
		const remisionRepo = {
			getNextConsecutive,
			create,
		} as unknown as IRemisionRepository;
		const companyRepo = {
			findById: vi.fn().mockResolvedValue(makeCompany("comp1")),
		} as unknown as ICompanyRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			companyRepo,
			clientRepo,
			{} as IDriverRepository,
		);

		let caught: unknown;
		try {
			await useCases.create(
				{
					type: "priced",
					documentType: "remision",
					companyId: "comp1",
					clientId: "cli1",
					items: [
						{
							description: "A",
							quantity: 1,
							unitPrice: 100,
							hasIva: true,
							ivaPercentage: 19,
						},
					],
					ivaValue: 999,
					hasRetencion: false,
				},
				"owner1",
				"admin",
			);
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect((caught as ValidationError).statusCode).toBe(422);
		expect(create).not.toHaveBeenCalled();
	});

	test("accepts a sent ivaValue that matches the derived sum", async () => {
		const getNextConsecutive = vi.fn().mockResolvedValue(1);
		const create = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = {
			getNextConsecutive,
			create,
		} as unknown as IRemisionRepository;
		const companyRepo = {
			findById: vi.fn().mockResolvedValue(makeCompany("comp1")),
		} as unknown as ICompanyRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			companyRepo,
			clientRepo,
			{} as IDriverRepository,
		);

		await useCases.create(
			{
				type: "priced",
				documentType: "remision",
				companyId: "comp1",
				clientId: "cli1",
				items: [
					{
						description: "A",
						quantity: 1,
						unitPrice: 100,
						hasIva: true,
						ivaPercentage: 19,
					},
				],
				ivaValue: 19,
				hasRetencion: false,
			},
			"owner1",
			"admin",
		);

		expect(create).toHaveBeenCalledTimes(1);
		const payload = create.mock.calls[0][0] as Record<string, unknown>;
		expect(payload.ivaValue).toBe(19);
	});
});

describe("RemisionUseCases.update", () => {
	test("returns clientName for the remision clientId", async () => {
		const findById = vi.fn().mockResolvedValue(makeRemision("id1"));
		const update = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = {
			findById,
			update,
		} as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		const result = await useCases.update(
			"id1",
			{ notes: "actualizada" },
			"owner1",
			"admin",
		);

		expect(result.clientName).toBe("Cliente A");
	});

	test("clientName is empty string when client is null", async () => {
		const findById = vi.fn().mockResolvedValue(makeRemision("id1"));
		const update = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = {
			findById,
			update,
		} as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(null),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		const result = await useCases.update(
			"id1",
			{ notes: "actualizada" },
			"owner1",
			"admin",
		);

		expect(result.clientName).toBe("");
	});

	test("type switch to quantity_only persists type and undefined totals", async () => {
		const findById = vi.fn().mockResolvedValue(makeRemision("id1"));
		const update = vi.fn().mockResolvedValue(makeRemision("id1"));
		const remisionRepo = {
			findById,
			update,
		} as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		await useCases.update("id1", { type: "quantity_only" }, "owner1", "admin");

		const payload = update.mock.calls[0][1] as Record<string, unknown>;
		expect(payload.type).toBe("quantity_only");
		expect(payload).toHaveProperty("subtotal");
		expect(payload).toHaveProperty("ivaValue");
		expect(payload).toHaveProperty("retencionValue");
		expect(payload).toHaveProperty("total");
		expect(payload.subtotal).toBeUndefined();
		expect(payload.ivaValue).toBeUndefined();
		expect(payload.retencionValue).toBeUndefined();
		expect(payload.total).toBeUndefined();
	});

	test("type switch to priced persists type and computed totals", async () => {
		const stored = {
			...makeRemision("id1"),
			type: "quantity_only" as const,
			subtotal: undefined,
			ivaValue: undefined,
			total: undefined,
		};
		const findById = vi.fn().mockResolvedValue(stored);
		const update = vi.fn().mockResolvedValue(stored);
		const remisionRepo = {
			findById,
			update,
		} as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		await useCases.update("id1", { type: "priced" }, "owner1", "admin");

		const payload = update.mock.calls[0][1] as Record<string, unknown>;
		expect(payload.type).toBe("priced");
		expect(payload.subtotal).toBe(20);
		expect(payload.ivaValue).toBe(3.8);
		expect(payload.total).toBe(23.8);
	});

	test("hasRetencion false clears retencionValue and recomputes total without retention", async () => {
		const stored = {
			...makeRemision("id1"),
			hasRetencion: true,
			retencionPercentage: 2.5,
			retencionValue: 0.5,
			total: 23.3,
		};
		const findById = vi.fn().mockResolvedValue(stored);
		const update = vi.fn().mockResolvedValue(stored);
		const remisionRepo = {
			findById,
			update,
		} as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		await useCases.update("id1", { hasRetencion: false }, "owner1", "admin");

		const payload = update.mock.calls[0][1] as Record<string, unknown>;
		expect(payload.hasRetencion).toBe(false);
		expect(payload).toHaveProperty("retencionValue");
		expect(payload.retencionValue).toBeUndefined();
		expect(payload.total).toBe(23.8);
	});

	test("hasRetencion true with stored percentage recomputes retencionValue", async () => {
		const stored = {
			...makeRemision("id1"),
			hasRetencion: false,
			retencionPercentage: 2.5,
		};
		const findById = vi.fn().mockResolvedValue(stored);
		const update = vi.fn().mockResolvedValue(stored);
		const remisionRepo = {
			findById,
			update,
		} as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		await useCases.update("id1", { hasRetencion: true }, "owner1", "admin");

		const payload = update.mock.calls[0][1] as Record<string, unknown>;
		expect(payload.hasRetencion).toBe(true);
		expect(payload.retencionValue).toBe(0.5);
		expect(payload.total).toBe(23.3);
	});

	test("hasRetencion true without any percentage rejects with ValidationError 422", async () => {
		const stored = { ...makeRemision("id1"), hasRetencion: false };
		const findById = vi.fn().mockResolvedValue(stored);
		const update = vi.fn();
		const remisionRepo = {
			findById,
			update,
		} as unknown as IRemisionRepository;
		const clientRepo = {
			findById: vi.fn().mockResolvedValue(makeClient("cli1", "Cliente A")),
		} as unknown as IClientRepository;
		const useCases = new RemisionUseCases(
			remisionRepo,
			{} as ICompanyRepository,
			clientRepo,
			{} as IDriverRepository,
		);

		let caught: unknown;
		try {
			await useCases.update("id1", { hasRetencion: true }, "owner1", "admin");
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect((caught as ValidationError).statusCode).toBe(422);
		expect(update).not.toHaveBeenCalled();
	});
});
