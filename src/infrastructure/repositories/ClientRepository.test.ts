// Co-located unit tests for ClientRepository.listByOwner pagination.
// Conventions: bun:test + vi.mock of the Mongoose model; no real DB, no
// network/filesystem; relative imports with .js extension.
import { beforeEach, describe, expect, test, vi } from "bun:test";

vi.mock("@/infrastructure/database/models/Client.model.js", () => ({
	ClientModel: {
		find: vi.fn(),
		countDocuments: vi.fn(),
	},
}));

import type { Client } from "@/domain/entities/Client.js";
import { ClientModel } from "@/infrastructure/database/models/Client.model.js";
import { ClientRepository } from "@/infrastructure/repositories/ClientRepository.js";

const findMock = ClientModel.find as unknown as ReturnType<typeof vi.fn>;
const countDocumentsMock = ClientModel.countDocuments as unknown as ReturnType<
	typeof vi.fn
>;

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
		name: "Juan",
		documentId: "12345",
		address: "Calle 2",
		phone: "3009998877",
		email: "juan@correo.com",
		companyId: { toString: () => "comp1" },
		ownerId: { toString: () => "owner1" },
		createdAt,
		updatedAt,
	};
}

function expectedDomain(id: string): Client {
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

beforeEach(() => {
	findMock.mockReset();
	countDocumentsMock.mockReset();
});

describe("ClientRepository.listByOwner", () => {
	test("applies skip and limit derived from page and returns { items, total }", async () => {
		const query = makeQuery([makeDoc("id1"), makeDoc("id2")]);
		findMock.mockReturnValue(query);
		countDocumentsMock.mockResolvedValue(45);

		const repo = new ClientRepository();
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

		const repo = new ClientRepository();
		await repo.listByOwner("owner1", "compX", "foo", { limit: 20, page: 1 });

		const filter = {
			ownerId: "owner1",
			companyId: "compX",
			$text: { $search: "foo" },
		};
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

		const repo = new ClientRepository();
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

		const repo = new ClientRepository();
		const result = await repo.listByOwner("owner1", undefined, undefined, {
			limit: 20,
			page: 3,
		});

		expect(result).toEqual({ items: [], total: 10 });
	});
});

describe("ClientRepository.findIdsByName", () => {
	test("queries name with an escaped regex and projects only _id", async () => {
		const query = makeQuery([makeDoc("id1"), makeDoc("id2")]);
		findMock.mockReturnValue(query);

		const repo = new ClientRepository();
		const ids = await repo.findIdsByName("a.b");

		expect(findMock).toHaveBeenCalledWith({
			name: { $regex: "a\\.b", $options: "i" },
		});
		expect(query.select).toHaveBeenCalledWith("_id");
		expect(ids).toEqual(["id1", "id2"]);
	});

	test("escapes plus and other metacharacters literally", async () => {
		const query = makeQuery([]);
		findMock.mockReturnValue(query);

		const repo = new ClientRepository();
		await repo.findIdsByName("a+b");

		expect(findMock).toHaveBeenCalledWith({
			name: { $regex: "a\\+b", $options: "i" },
		});
	});

	test("uses a case-insensitive option on the name regex", async () => {
		const query = makeQuery([makeDoc("id1")]);
		findMock.mockReturnValue(query);

		const repo = new ClientRepository();
		await repo.findIdsByName("ACME");

		expect(findMock).toHaveBeenCalledWith({
			name: { $regex: "ACME", $options: "i" },
		});
	});

	test("returns [] without querying for whitespace-only input", async () => {
		const repo = new ClientRepository();
		const ids = await repo.findIdsByName("   ");
		expect(ids).toEqual([]);
		expect(findMock).not.toHaveBeenCalled();
	});

	test("returns [] without querying for empty string", async () => {
		const repo = new ClientRepository();
		const ids = await repo.findIdsByName("");
		expect(ids).toEqual([]);
		expect(findMock).not.toHaveBeenCalled();
	});
});
