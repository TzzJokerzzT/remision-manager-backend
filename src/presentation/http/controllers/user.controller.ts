import { Response, NextFunction } from 'express';
import { UserUseCases } from '../../../application/use-cases/user/UserUseCases.js';
import { AuthenticatedRequest } from '../middlewares/authenticate.js';

export class UserController {
  constructor(private readonly userUseCases: UserUseCases) {}

  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await this.userUseCases.getById(req.user!.id);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await this.userUseCases.getById(req.params.id);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  list = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const users = await this.userUseCases.list();
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await this.userUseCases.update(req.params.id, req.body, req.user!.id, req.user!.role);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.userUseCases.delete(req.params.id, req.user!.id, req.user!.role);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
