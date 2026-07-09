import { IUserRepository } from "../../../domain/repositories/IUserRepository.js";
import { PasswordService } from "../../../infrastructure/security/password.service.js";
import { JwtService } from "../../../infrastructure/security/jwt.service.js";
import { sha256 } from "../../../infrastructure/security/hash.util.js";
import {
	ConflictError,
	UnauthorizedError,
} from "../../../shared/errors/AppError.js";
import { RegisterDto, LoginDto } from "../../dtos/auth.dto.js";
import { SafeUser } from "../../../domain/entities/User.js";

function toSafeUser(user: {
	id: string;
	name: string;
	email: string;
	role: "admin" | "user";
	companyLogoUrl?: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}): SafeUser {
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

interface TokenPair {
	accessToken: string;
	refreshToken: string;
}

export class AuthUseCases {
	constructor(
		private readonly userRepo: IUserRepository & {
			setRefreshTokenHash(id: string, hash: string | null): Promise<void>;
			getRefreshTokenHash(id: string): Promise<string | null>;
		},
	) {}

	async register(
		dto: RegisterDto,
	): Promise<{ user: SafeUser; tokens: TokenPair }> {
		const existing = await this.userRepo.findByEmail(dto.email);
		if (existing) throw new ConflictError("Ya existe un usuario con ese email");

		const passwordHash = await PasswordService.hash(dto.password);
		const isFirstUser = (await this.userRepo.list({})).length === 0;

		const user = await this.userRepo.create({
			name: dto.name,
			email: dto.email.toLowerCase(),
			passwordHash,
			role: isFirstUser ? "admin" : "user", // primer usuario registrado = admin
			companyLogoUrl: null,
			isActive: true,
		});

		const tokens = await this.issueTokens(user.id, user.role);
		return { user: toSafeUser(user), tokens };
	}

	async login(dto: LoginDto): Promise<{ user: SafeUser; tokens: TokenPair }> {
		const user = await this.userRepo.findByEmail(dto.email);
		if (!user || !user.isActive)
			throw new UnauthorizedError("Credenciales inválidas");

		const valid = await PasswordService.compare(
			dto.password,
			user.passwordHash,
		);
		if (!valid) throw new UnauthorizedError("Credenciales inválidas");

		const tokens = await this.issueTokens(user.id, user.role);
		return { user: toSafeUser(user), tokens };
	}

	async refresh(refreshToken: string): Promise<TokenPair> {
		let payload;
		try {
			payload = JwtService.verifyRefreshToken(refreshToken);
		} catch {
			throw new UnauthorizedError("Refresh token inválido o expirado");
		}

		const storedHash = await this.userRepo.getRefreshTokenHash(payload.sub);
		if (!storedHash || storedHash !== sha256(refreshToken)) {
			throw new UnauthorizedError("Refresh token inválido o ya fue usado");
		}

		const user = await this.userRepo.findById(payload.sub);
		if (!user || !user.isActive)
			throw new UnauthorizedError("Usuario no válido");

		// Rotación: el refresh token anterior queda invalidado al emitir uno nuevo
		return this.issueTokens(user.id, user.role);
	}

	async logout(userId: string): Promise<void> {
		await this.userRepo.setRefreshTokenHash(userId, null);
	}

	private async issueTokens(
		userId: string,
		role: "admin" | "user",
	): Promise<TokenPair> {
		const accessToken = JwtService.signAccessToken({ sub: userId, role });
		const refreshToken = JwtService.signRefreshToken({ sub: userId, role });
		await this.userRepo.setRefreshTokenHash(userId, sha256(refreshToken));
		return { accessToken, refreshToken };
	}
}
