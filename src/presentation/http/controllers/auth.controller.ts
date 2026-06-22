import { Response, NextFunction } from 'express';
import { AuthUseCases } from '../../../application/use-cases/auth/AuthUseCases.js';
import { AuthenticatedRequest } from '../middlewares/authenticate.js';

export class AuthController {
  constructor(private readonly authUseCases: AuthUseCases) {}

  register = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.authUseCases.register(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.authUseCases.login(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authUseCases.refresh(req.body.refreshToken);
      res.status(200).json({ success: true, data: tokens });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.authUseCases.logout(req.user!.id);
      res.status(200).json({ success: true, message: 'Sesión cerrada' });
    } catch (err) {
      next(err);
    }
  };
}
