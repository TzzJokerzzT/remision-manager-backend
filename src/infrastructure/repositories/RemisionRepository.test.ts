// Co-located unit tests for RemisionRepository.listByOwner filtering.
// Conventions: bun:test + vi.mock of the Mongoose model; no real DB, no
// network/filesystem; relative imports with .js extension.
import { beforeEach, describe, expect, test, vi } from "bun:test";

vi.mock("../database/models/Remision.model.js", () => ({
	RemisionModel: {
		find: vi.fn(),
		findOne: vi.fn(),
		countDocuments: vi.fn(),
	},
}));

vi.mock("../database/models/Counter.model.js", () => ({
	CounterModel: {
		findOneAndUpdate: vi.fn(),
		create: vi.fn(),
	},
}));

import type { Remision } from "../../domain/entities/Remision.js";
import { CounterModel } from "../database/models/Counter.model.js";
import { RemisionModel } from "../database/models/Remision.model.js";
import { RemisionRepository } from "./RemisionRepository.js";

const findMock = RemisionModel.find as unknown as ReturnType<typeof vi.fn>;
const findOneMock = RemisionModel.findOne as unknown as ReturnType<
	typeof vi.fn
>;
const countDocumentsMock =
	RemisionModel.countDocuments as unknown as ReturnType<typeof vi.fn>;
const counterFindOneAndUpdateMock =
	CounterModel.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;
const counterCreateMock = CounterModel.create as unknown as ReturnType<
	typeof vi.fn
>;

type MockQuery = Promise<unknown> & {
	select: ReturnType<typeof vi.fn>;
	sort: ReturnType<typeof vi.fn>;
	skip: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
	lean: ReturnType<typeof vi.fn>;
};

function makeQuery(docs: unknown[]): MockQuery {
	const query = Promise.resolve(docs) as MockQuery;
	query.select = vi.fn(() => query);
	query.sort = vi.fn(() => query);
	query.skip = vi.fn(() => query);
	query.limit = vi.fn(() => query);
	query.lean = vi.fn(() => query);
	return query;
}

const createdAt = new Date("2024-01-01T00:00:00Z");
const updatedAt = new Date("2024-01-02T00:00:00Z");

function makeDoc(id: string) {
	return {
		id: { toString: () => id },
		consecutive: 1,
		type: "priced",
		documentType: "remision",
		companyId: { toString: () => "comp1" },
		clientId: { toString: () => "cli1" },
		driverId: { toString: () => "drv1" },
		items: [{ description: "Item", quantity: 2, unitPrice: 10 }],
		subtotal: 20,
		ivaPercentage: 19,
		ivaValue: 3.8,
		hasRetencion: false,
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
		documentType: "remision",
		companyId: "comp1",
		clientId: "cli1",
		driverId: "drv1",
		items: [{ description: "Item", quantity: 2, unitPrice: 10 }],
		subtotal: 20,
		ivaPercentage: 19,
		ivaValue: 3.8,
		hasRetencion: false,
		total: 23.8,
		notes: "nota",
		ownerId: "owner1",
		createdAt,
		updatedAt,
	};
}

beforeEach(() => {
	findMock.mockReset();
	findOneMock.mockReset();
	countDocumentsMock.mockReset();
	counterFindOneAndUpdateMock.mockReset();
	counterCreateMock.mockReset();
});

describe("RemisionRepository.listByOwner", () => {
	test("applies skip and limit derived from page and returns { items, total }", async () => {
		const query = makeQuery([makeDoc("id1"), makeDoc("id2")]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(45);

		const repo = new RemisionRepository();
		const result = await repo.listByOwner(
			"owner1",
			{ companyId: "compX" },
			{ limit: 20, page: 2 },
		);

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
		await repo.listByOwner("owner1", { search: "foo" }, { limit: 20, page: 1 });

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
		const result = await repo.listByOwner("owner1", undefined, {
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
		const result = await repo.listByOwner("owner1", undefined, {
			limit: 20,
			page: 3,
		});

		expect(result).toEqual({ items: [], total: 10 });
	});

	test("clientIds empty array produces clientId $in [] (not omitted)", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(0);

		const repo = new RemisionRepository();
		await repo.listByOwner("owner1", { clientIds: [] }, { limit: 20, page: 1 });

		const expectedFilter = { ownerId: "owner1", clientId: { $in: [] } };
		expect(findMock).toHaveBeenCalledWith(expectedFilter);
		expect(countDocumentsMock).toHaveBeenCalledWith(expectedFilter);
	});

	test("driverIds produces driverId $in", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(0);

		const repo = new RemisionRepository();
		await repo.listByOwner(
			"owner1",
			{ driverIds: ["drv1", "drv2"] },
			{ limit: 20, page: 1 },
		);

		const expectedFilter = {
			ownerId: "owner1",
			driverId: { $in: ["drv1", "drv2"] },
		};
		expect(findMock).toHaveBeenCalledWith(expectedFilter);
		expect(countDocumentsMock).toHaveBeenCalledWith(expectedFilter);
	});

	test("type sets filter.type", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(0);

		const repo = new RemisionRepository();
		await repo.listByOwner(
			"owner1",
			{ type: "priced" },
			{ limit: 20, page: 1 },
		);

		const expectedFilter = { ownerId: "owner1", type: "priced" };
		expect(findMock).toHaveBeenCalledWith(expectedFilter);
		expect(countDocumentsMock).toHaveBeenCalledWith(expectedFilter);
	});

	test("from and to set createdAt $gte and $lte", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(0);

		const from = new Date("2026-01-01T00:00:00Z");
		const to = new Date("2026-01-31T23:59:59.999Z");
		const repo = new RemisionRepository();
		await repo.listByOwner("owner1", { from, to }, { limit: 20, page: 1 });

		const expectedFilter = {
			ownerId: "owner1",
			createdAt: { $gte: from, $lte: to },
		};
		expect(findMock).toHaveBeenCalledWith(expectedFilter);
		expect(countDocumentsMock).toHaveBeenCalledWith(expectedFilter);
	});

	test("from only sets createdAt $gte", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(0);

		const from = new Date("2026-01-01T00:00:00Z");
		const repo = new RemisionRepository();
		await repo.listByOwner("owner1", { from }, { limit: 20, page: 1 });

		const expectedFilter = {
			ownerId: "owner1",
			createdAt: { $gte: from },
		};
		expect(findMock).toHaveBeenCalledWith(expectedFilter);
		expect(countDocumentsMock).toHaveBeenCalledWith(expectedFilter);
	});

	test("composes all filters (companyId + search + clientIds + driverIds + type + date)", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(0);

		const from = new Date("2026-01-01T00:00:00Z");
		const to = new Date("2026-01-31T23:59:59.999Z");
		const repo = new RemisionRepository();
		await repo.listByOwner(
			"owner1",
			{
				companyId: "compX",
				search: "foo",
				clientIds: ["cli1"],
				driverIds: ["drv1"],
				type: "quantity_only",
				from,
				to,
			},
			{ limit: 20, page: 1 },
		);

		const expectedFilter = {
			ownerId: "owner1",
			companyId: "compX",
			$text: { $search: "foo" },
			clientId: { $in: ["cli1"] },
			driverId: { $in: ["drv1"] },
			type: "quantity_only",
			createdAt: { $gte: from, $lte: to },
		};
		expect(findMock).toHaveBeenCalledWith(expectedFilter);
		expect(countDocumentsMock).toHaveBeenCalledWith(expectedFilter);
	});
});

describe("RemisionRepository.getNextConsecutive", () => {
	test("increments existing counter and returns new seq", async () => {
		counterFindOneAndUpdateMock.mockResolvedValue({ seq: 5 });

		const repo = new RemisionRepository();
		const result = await repo.getNextConsecutive("comp1");

		expect(result).toBe(5);
		expect(counterFindOneAndUpdateMock).toHaveBeenCalledWith(
			{ companyId: "comp1" },
			{ $inc: { seq: 1 } },
			{ new: true, upsert: false },
		);
	});

	test("seeds counter from last remision when counter is missing", async () => {
		counterFindOneAndUpdateMock.mockResolvedValue(null);

		const leanMock = vi.fn().mockResolvedValue({ consecutive: 10 });
		const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
		const sortMock = vi.fn().mockReturnValue({ select: selectMock });
		findOneMock.mockReturnValue({ sort: sortMock });

		counterCreateMock.mockResolvedValue({ seq: 11 });

		const repo = new RemisionRepository();
		const result = await repo.getNextConsecutive("comp1");

		expect(result).toBe(11);
		expect(findOneMock).toHaveBeenCalledWith({ companyId: "comp1" });
		expect(counterCreateMock).toHaveBeenCalledWith({
			companyId: "comp1",
			seq: 11,
		});
	});

	test("starts at 1 when no counter and no remisiones exist", async () => {
		counterFindOneAndUpdateMock.mockResolvedValue(null);

		const leanMock = vi.fn().mockResolvedValue(null);
		const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
		const sortMock = vi.fn().mockReturnValue({ select: selectMock });
		findOneMock.mockReturnValue({ sort: sortMock });

		counterCreateMock.mockResolvedValue({ seq: 1 });

		const repo = new RemisionRepository();
		const result = await repo.getNextConsecutive("comp1");

		expect(result).toBe(1);
		expect(counterCreateMock).toHaveBeenCalledWith({
			companyId: "comp1",
			seq: 1,
		});
	});

	test("retries atomic increment on duplicate-key race during seed", async () => {
		counterFindOneAndUpdateMock
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ seq: 3 });

		const leanMock = vi.fn().mockResolvedValue({ consecutive: 2 });
		const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
		const sortMock = vi.fn().mockReturnValue({ select: selectMock });
		findOneMock.mockReturnValue({ sort: sortMock });

		counterCreateMock.mockRejectedValue({ code: 11000 });

		const repo = new RemisionRepository();
		const result = await repo.getNextConsecutive("comp1");

		expect(result).toBe(3);
		expect(counterFindOneAndUpdateMock).toHaveBeenCalledTimes(2);
	});
});
