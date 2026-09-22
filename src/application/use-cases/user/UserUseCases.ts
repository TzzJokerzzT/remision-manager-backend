import type { UpdateUserDto } from "@/application/dtos/user.dto.js";
import type { SafeUser, User } from "@/domain/entities/User.js";
import type { IUserRepository } from "@/domain/repositories/IUserRepository.js";
import { ForbiddenError, NotFoundError } from "@/shared/errors/AppError.js";

function toSafeUser(user: User): SafeUser {
	const {
		id,
		name,
		email,
		role,
		companyLogoUrl,
		isActive,
		createdAt,
		updatedAt,
	} = user;
	return {
		id,
		name,
		email,
		role,
		companyLogoUrl,
		isActive,
		createdAt,
		updatedAt,
	};
}

export class UserUseCases {
	constructor(private readonly userRepo: IUserRepository) {}

	async getById(id: string): Promise<SafeUser> {
		const user = await this.userRepo.findById(id);
		if (!user) throw new NotFoundError("Usuario");
		return toSafeUser(user);
	}

	async list(): Promise<SafeUser[]> {
		const users = await this.userRepo.list({});
		return users.map(toSafeUser);
	}

	// requesterId/requesterRole controlan que un usuario normal solo edite su propio perfil
	async update(
		id: string,
		dto: UpdateUserDto,
		requesterId: string,
		requesterRole: "admin" | "user",
	): Promise<SafeUser> {
		if (requesterRole !== "admin" && requesterId !== id) {
			throw new ForbiddenError("No puedes modificar otro usuario");
		}
		const updated = await this.userRepo.update(id, dto);
		if (!updated) throw new NotFoundError("Usuario");
		return toSafeUser(updated);
	}

	async delete(
		id: string,
		requesterId: string,
		requesterRole: "admin" | "user",
	): Promise<void> {
		if (requesterRole !== "admin" && requesterId !== id) {
			throw new ForbiddenError("No puedes eliminar otro usuario");
		}
		const ok = await this.userRepo.delete(id);
		if (!ok) throw new NotFoundError("Usuario");
	}
}
