// src/index.ts
import { env } from './config/env.js';
import { connectDatabase } from './infrastructure/database/mongoose.js';
import { createServer } from './presentation/http/server.js';

const app = createServer();

// Export para Vercel serverless
export default app;

// Solo escucha en desarrollo local (Vercel no llega a esta línea)
if (process.env.VERCEL !== '1') {
  connectDatabase().then(() => {
    app.listen(env.PORT, () => {
      console.log(`🚀 Servidor en http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    });
  });
}
