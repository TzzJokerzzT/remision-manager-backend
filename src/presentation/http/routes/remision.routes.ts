import { Router } from 'express';
import { z } from 'zod';
import { RemisionController } from '../controllers/remision.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { createRemisionSchema, updateRemisionSchema } from '../../../application/dtos/remision.dto.js';
import { mongoIdSchema } from '../../../application/dtos/user.dto.js';

export function buildRemisionRoutes(controller: RemisionController): Router {
  const router = Router();
  const idParamSchema = z.object({ id: mongoIdSchema });

  router.use(authenticate);

  router.post('/', validate(createRemisionSchema), controller.create);
  router.get('/', controller.list);
  router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
  router.patch('/:id', validate(idParamSchema, 'params'), validate(updateRemisionSchema), controller.update);
  router.delete('/:id', validate(idParamSchema, 'params'), controller.delete);

  return router;
}
