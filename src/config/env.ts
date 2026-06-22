import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(3000),

	MONGO_URI: z.string().min(1, "MONGO_URI es requerido"),

	JWT_ACCESS_SECRET: z
		.string()
		.min(32, "JWT_ACCESS_SECRET debe tener al menos 32 caracteres"),
	JWT_REFRESH_SECRET: z
		.string()
		.min(32, "JWT_REFRESH_SECRET debe tener al menos 32 caracteres"),
	JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
	JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

	CORS_ORIGINS: z.string().default("http://localhost:5173"),

	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
	RATE_LIMIT_MAX: z.coerce.number().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error(
		"❌ Variables de entorno inválidas:",
		parsed.error.flatten().fieldErrors,
	);
	process.exit(1);
}

export const env = {
	...parsed.data,
	CORS_ORIGINS_LIST: parsed.data.CORS_ORIGINS.split(",").map((o) => o.trim()),
};
