// src/index.ts
import { env } from './config/env';
import { connectDatabase } from './infrastructure/database/mongoose';
import { createServer } from './src/index';

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
