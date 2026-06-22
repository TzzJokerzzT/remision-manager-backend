import { env } from './config/env.js';
import { connectDatabase } from './infrastructure/database/mongoose.js';
import { createServer } from './presentation/http/server.js';

async function bootstrap() {
  await connectDatabase();

  const app = createServer();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n${signal} recibido. Cerrando servidor...`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('❌ Error al iniciar la aplicación:', err);
  process.exit(1);
});
