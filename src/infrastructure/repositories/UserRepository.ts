import type { User } from "../../domain/entities/User.js";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import { type UserDocument, UserModel } from "../database/models/User.model.js";

function toDomain(doc: UserDocument): User {
	return {
		id: doc.id.toString(),
		name: doc.name,
		email: doc.email,
		passwordHash: doc.passwordHash,
		role: doc.role,
		companyLogoUrl: doc.companyLogoUrl ?? null,
		isActive: doc.isActive,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
	};
}

export class UserRepository implements IUserRepository {
	async create(
		data: Omit<User, "id" | "createdAt" | "updatedAt">,
	): Promise<User> {
		const doc = await UserModel.create(data);
		return toDomain(doc);
	}

	async findById(id: string): Promise<User | null> {
		const doc = await UserModel.findById(id).select("+passwordHash");
		return doc ? toDomain(doc) : null;
	}

	async findByEmail(email: string): Promise<User | null> {
		const doc = await UserModel.findOne({
			email: email.toLowerCase().trim(),
		}).select("+passwordHash");
		return doc ? toDomain(doc) : null;
	}

	async update(id: string, data: Partial<User>): Promise<User | null> {
		const doc = await UserModel.findByIdAndUpdate(id, data, {
			new: true,
			runValidators: true,
		});
		return doc ? toDomain(doc) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await UserModel.findByIdAndDelete(id);
		return !!result;
	}

	async list(filter: { isActive?: boolean }): Promise<User[]> {
		const docs = await UserModel.find(filter);
		return docs.map(toDomain);
	}

	// Usado internamente por AuthRepository para refresh token rotation
	async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
		await UserModel.findByIdAndUpdate(id, { refreshTokenHash: hash });
	}

	async getRefreshTokenHash(id: string): Promise<string | null> {
		const doc = await UserModel.findById(id).select("+refreshTokenHash");
		return doc?.refreshTokenHash ?? null;
	}
}
