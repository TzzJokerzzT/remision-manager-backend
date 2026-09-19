// Co-located unit tests for RemisionRepository.listByOwner pagination.
// Conventions: bun:test + vi.mock of the Mongoose model; no real DB, no
// network/filesystem; relative imports with .js extension.
import { beforeEach, describe, expect, test, vi } from "bun:test";

vi.mock("../database/models/Remision.model.js", () => ({
	RemisionModel: {
		find: vi.fn(),
		countDocuments: vi.fn(),
	},
}));

import type { Remision } from "../../domain/entities/Remision.js";
import { RemisionModel } from "../database/models/Remision.model.js";
import { RemisionRepository } from "./RemisionRepository.js";

const findMock = RemisionModel.find as unknown as ReturnType<typeof vi.fn>;
const countDocumentsMock =
	RemisionModel.countDocuments as unknown as ReturnType<typeof vi.fn>;

type MockQuery = Promise<unknown> & {
	select: ReturnType<typeof vi.fn>;
	sort: ReturnType<typeof vi.fn>;
	skip: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
};

function makeQuery(docs: unknown[]): MockQuery {
	const query = Promise.resolve(docs) as MockQuery;
	query.select = vi.fn(() => query);
	query.sort = vi.fn(() => query);
	query.skip = vi.fn(() => query);
	query.limit = vi.fn(() => query);
	return query;
}

const createdAt = new Date("2024-01-01T00:00:00Z");
const updatedAt = new Date("2024-01-02T00:00:00Z");

function makeDoc(id: string) {
	return {
		id: { toString: () => id },
		consecutive: 1,
		type: "priced",
		companyId: { toString: () => "comp1" },
		clientId: { toString: () => "cli1" },
		driverId: { toString: () => "drv1" },
		items: [{ description: "Item", quantity: 2, unitPrice: 10 }],
		subtotal: 20,
		ivaPercentage: 19,
		ivaValue: 3.8,
		total: 23.8,
		notes: "nota",
		ownerId: { toString: () => "owner1" },
		createdAt,
		updatedAt,
	};
}

function expectedDomain(id: string): Remision {
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

beforeEach(() => {
	findMock.mockReset();
	countDocumentsMock.mockReset();
});

describe("RemisionRepository.listByOwner", () => {
	test("applies skip and limit derived from page and returns { items, total }", async () => {
		const query = makeQuery([makeDoc("id1"), makeDoc("id2")]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(45);

		const repo = new RemisionRepository();
		const result = await repo.listByOwner("owner1", "compX", undefined, {
			limit: 20,
			page: 2,
		});

		expect(findMock).toHaveBeenCalledWith({
			ownerId: "owner1",
			companyId: "compX",
		});
		expect(query.skip).toHaveBeenCalledWith(20);
		expect(query.limit).toHaveBeenCalledWith(20);
		expect(countDocumentsMock).toHaveBeenCalledWith({
			ownerId: "owner1",
			companyId: "compX",
		});
		expect(result).toEqual({
			items: [expectedDomain("id1"), expectedDomain("id2")],
			total: 45,
		});
	});

	test("countDocuments receives the same filter including $text when search present", async () => {
		const query = makeQuery([makeDoc("id1")]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(1);

		const repo = new RemisionRepository();
		await repo.listByOwner("owner1", undefined, "foo", { limit: 20, page: 1 });

		const filter = { ownerId: "owner1", $text: { $search: "foo" } };
		expect(findMock).toHaveBeenCalledWith(filter);
		expect(query.select).toHaveBeenCalledWith({
			score: { $meta: "textScore" },
		});
		expect(query.sort).toHaveBeenCalledWith({ score: { $meta: "textScore" } });
		expect(countDocumentsMock).toHaveBeenCalledWith(filter);
	});

	test("returns empty items and zero total for an empty result", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(0);

		const repo = new RemisionRepository();
		const result = await repo.listByOwner("owner1", undefined, undefined, {
			limit: 20,
			page: 1,
		});

		expect(result).toEqual({ items: [], total: 0 });
	});

	test("page beyond last page returns empty items with the correct total", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(10);

		const repo = new RemisionRepository();
		const result = await repo.listByOwner("owner1", undefined, undefined, {
			limit: 20,
			page: 3,
		});

		expect(result).toEqual({ items: [], total: 10 });
	});
});
