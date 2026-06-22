import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate.js';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/AppError.js';

export function authorize(...roles: Array<'admin' | 'user'>) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('No tienes permisos para esta acción'));
    }
    next();
  };
}
