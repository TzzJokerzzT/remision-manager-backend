import { Response, NextFunction } from 'express';
import { RemisionUseCases } from '../../../application/use-cases/remision/RemisionUseCases.js';
import { AuthenticatedRequest } from '../middlewares/authenticate.js';

export class RemisionController {
  constructor(private readonly remisionUseCases: RemisionUseCases) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const remision = await this.remisionUseCases.create(req.body, req.user!.id, req.user!.role);
      res.status(201).json({ success: true, data: remision });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const remision = await this.remisionUseCases.getById(req.params.id, req.user!.id, req.user!.role);
      res.json({ success: true, data: remision });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      const remisiones = await this.remisionUseCases.listMine(req.user!.id, companyId);
      res.json({ success: true, data: remisiones });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const remision = await this.remisionUseCases.update(req.params.id, req.body, req.user!.id, req.user!.role);
      res.json({ success: true, data: remision });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.remisionUseCases.delete(req.params.id, req.user!.id, req.user!.role);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
