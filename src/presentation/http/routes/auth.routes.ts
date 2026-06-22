import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { registerSchema, loginSchema, refreshSchema } from '../../../application/dtos/auth.dto.js';

export function buildAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post('/register', authLimiter, validate(registerSchema), controller.register);
  router.post('/login', authLimiter, validate(loginSchema), controller.login);
  router.post('/refresh', authLimiter, validate(refreshSchema), controller.refresh);
  router.post('/logout', authenticate, controller.logout);

  return router;
}
