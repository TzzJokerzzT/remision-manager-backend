import { Response, NextFunction } from 'express';
import { CompanyUseCases } from '../../../application/use-cases/company/CompanyUseCases.js';
import { AuthenticatedRequest } from '../middlewares/authenticate.js';

export class CompanyController {
  constructor(private readonly companyUseCases: CompanyUseCases) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const company = await this.companyUseCases.create(req.body, req.user!.id);
      res.status(201).json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const company = await this.companyUseCases.getById(req.params.id, req.user!.id, req.user!.role);
      res.json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const companies = await this.companyUseCases.listMine(req.user!.id, search);
      res.json({ success: true, data: companies });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const company = await this.companyUseCases.update(req.params.id, req.body, req.user!.id, req.user!.role);
      res.json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.companyUseCases.delete(req.params.id, req.user!.id, req.user!.role);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
