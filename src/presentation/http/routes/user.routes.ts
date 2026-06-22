import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { updateUserSchema, mongoIdSchema } from '../../../application/dtos/user.dto.js';
import { z } from 'zod';

export function buildUserRoutes(controller: UserController): Router {
  const router = Router();
  const idParamSchema = z.object({ id: mongoIdSchema });

  router.use(authenticate);

  router.get('/me', controller.me);
  router.get('/', authorize('admin'), controller.list);
  router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
  router.patch('/:id', validate(idParamSchema, 'params'), validate(updateUserSchema), controller.update);
  router.delete('/:id', validate(idParamSchema, 'params'), controller.delete);

  return router;
}
