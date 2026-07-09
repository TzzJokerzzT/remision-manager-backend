import { User } from "../entities/User.js";

export interface IUserRepository {
	create(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
	findById(id: string): Promise<User | null>;
	findByEmail(email: string): Promise<User | null>;
	update(id: string, data: Partial<User>): Promise<User | null>;
	delete(id: string): Promise<boolean>;
	list(filter: { isActive?: boolean }): Promise<User[]>;
}
