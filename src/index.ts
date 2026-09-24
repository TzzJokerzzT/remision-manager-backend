import { env } from "./config/env.js";
import { disconnectDatabase } from "./infrastructure/database/mongoose.js";
import { createServer } from "./presentation/http/server.js";
import { logger } from "./shared/logger.js";

const app = createServer();

export default app;

if (process.env.VERCEL !== "1") {
	const server = app.listen(env.PORT, () => {
		logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Server started");
	});

	const shutdown = async () => {
		logger.info("Shutting down gracefully...");
		const forceExit = setTimeout(() => {
			logger.error("Forced exit after timeout");
			process.exit(1);
		}, 5000);
		forceExit.unref();

		try {
			server.close();
			await disconnectDatabase();
			logger.info("Shutdown complete");
			process.exit(0);
		} catch (err) {
			logger.error({ err }, "Error during shutdown");
			process.exit(1);
		}
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}
