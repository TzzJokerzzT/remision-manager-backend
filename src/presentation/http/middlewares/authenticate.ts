import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../../../infrastructure/security/jwt.service.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: 'admin' | 'user' };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token no proporcionado'));
  }
  const token = header.slice(7);
  try {
    const payload = JwtService.verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}
