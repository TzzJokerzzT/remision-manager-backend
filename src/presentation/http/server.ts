import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from '../../config/env.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

import { buildAuthRoutes } from './routes/auth.routes.js';
import { buildUserRoutes } from './routes/user.routes.js';
import { buildCompanyRoutes } from './routes/company.routes.js';
import { buildClientRoutes } from './routes/client.routes.js';
import { buildDriverRoutes } from './routes/driver.routes.js';
import { buildRemisionRoutes } from './routes/remision.routes.js';

import {
  authController,
  userController,
  companyController,
  clientController,
  driverController,
  remisionController,
} from '../../di/container.js';

export function createServer(): Application {
  const app = express();

  // --- Seguridad base ---
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // necesario si está detrás de un proxy/load balancer (Vercel, Nginx, etc.)

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // permite requests sin origin (curl, apps móviles) y los orígenes configurados
        if (!origin || env.CORS_ORIGINS_LIST.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('No permitido por CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Sanitiza req.body/params/query contra inyección de operadores Mongo ($gt, $where, etc.)
  app.use(
    mongoSanitize({
      replaceWith: '_',
    })
  );

  // Previene HTTP Parameter Pollution (?role=admin&role=user)
  app.use(hpp());

  app.use(generalLimiter);

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // --- Rutas ---
  app.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));

  app.use('/api/auth', buildAuthRoutes(authController));
  app.use('/api/users', buildUserRoutes(userController));
  app.use('/api/companies', buildCompanyRoutes(companyController));
  app.use('/api/clients', buildClientRoutes(clientController));
  app.use('/api/drivers', buildDriverRoutes(driverController));
  app.use('/api/remisiones', buildRemisionRoutes(remisionController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
