import { JwtService } from "../../../infrastructure/security/jwt.service.js";

export function generateAccessToken(
	userId: string,
	role: "admin" | "user" = "user",
): string {
	return JwtService.signAccessToken({ sub: userId, role });
}

export function generateAuthHeader(
	userId: string,
	role: "admin" | "user" = "user",
): Record<string, string> {
	return { Authorization: `Bearer ${generateAccessToken(userId, role)}` };
}
