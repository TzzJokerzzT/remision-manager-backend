// Shared integration test bootstrap.
// Import this as the FIRST line in every integration test file so that
// process.env is set before src/config/env.js evaluates.
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// --- env bootstrap (must run before any import of env.ts) ---
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.MONGO_URI = "mongodb://localhost:27017/test"; // overwritten by startTestDatabase
process.env.JWT_ACCESS_SECRET = "test-access-secret-min-32-chars-ok!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-min-32-chars-ok!";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.RATE_LIMIT_WINDOW_MS = "900000";
process.env.RATE_LIMIT_MAX = "300";

// --- MongoMemoryServer singleton ---
let mongod: MongoMemoryServer | null = null;
let connected = false;

export async function startTestDatabase(): Promise<void> {
	if (connected) return;

	mongod = await MongoMemoryServer.create();
	process.env.MONGO_URI = mongod.getUri();

	await mongoose.connect(process.env.MONGO_URI);
	connected = true;
}

export async function stopTestDatabase(): Promise<void> {
	if (!connected) return;
	await mongoose.disconnect();
	if (mongod) {
		await mongod.stop();
		mongod = null;
	}
	connected = false;
}

export async function cleanDatabase(): Promise<void> {
	if (!connected) return;
	for (const model of Object.values(mongoose.models)) {
		await model.deleteMany({});
	}
}
