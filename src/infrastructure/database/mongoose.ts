import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";

mongoose.set("strictQuery", true);
// strict: true (default) ya evita que se guarden campos no definidos en el schema,
// lo que junto a express-mongo-sanitize protege contra inyección de operadores NoSQL ($ne, $gt, etc).

export async function connectDatabase(): Promise<void> {
	await mongoose.connect(env.MONGO_URI);
	logger.info("MongoDB connected");
}

export async function disconnectDatabase(): Promise<void> {
	await mongoose.disconnect();
}
