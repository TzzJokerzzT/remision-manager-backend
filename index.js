import { env } from "./src/config/env";

import { connectDatabase } from "./src/infrastructure/database/mongoose";
import { createServer } from "./src/presentation/http/server";

async function bootstrap() {
	await connectDatabase();

	const app = createServer();

	const server = app.listen(env.PORT, () => {
		console.log(
			`🚀 Servidor corriendo en http://localhost:${env.PORT} [${env.NODE_ENV}]`,
		);
	});

	const shutdown = (signal) => {
		console.log(`\n${signal} recibido. Cerrando servidor...`);
		server.close(() => process.exit(0));
	};

	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
	console.error("❌ Error al iniciar la aplicación:", err);
	process.exit(1);
});
