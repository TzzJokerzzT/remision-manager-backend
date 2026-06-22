import { UserRepository } from '../infrastructure/repositories/UserRepository.js';
import { CompanyRepository } from '../infrastructure/repositories/CompanyRepository.js';
import { ClientRepository } from '../infrastructure/repositories/ClientRepository.js';
import { DriverRepository } from '../infrastructure/repositories/DriverRepository.js';
import { RemisionRepository } from '../infrastructure/repositories/RemisionRepository.js';

import { AuthUseCases } from '../application/use-cases/auth/AuthUseCases.js';
import { UserUseCases } from '../application/use-cases/user/UserUseCases.js';
import { CompanyUseCases } from '../application/use-cases/company/CompanyUseCases.js';
import { ClientUseCases } from '../application/use-cases/client/ClientUseCases.js';
import { DriverUseCases } from '../application/use-cases/driver/DriverUseCases.js';
import { RemisionUseCases } from '../application/use-cases/remision/RemisionUseCases.js';

import { AuthController } from '../presentation/http/controllers/auth.controller.js';
import { UserController } from '../presentation/http/controllers/user.controller.js';
import { CompanyController } from '../presentation/http/controllers/company.controller.js';
import { ClientController } from '../presentation/http/controllers/client.controller.js';
import { DriverController } from '../presentation/http/controllers/driver.controller.js';
import { RemisionController } from '../presentation/http/controllers/remision.controller.js';

// Repositorios (infraestructura)
const userRepository = new UserRepository();
const companyRepository = new CompanyRepository();
const clientRepository = new ClientRepository();
const driverRepository = new DriverRepository();
const remisionRepository = new RemisionRepository();

// Casos de uso (aplicación)
const authUseCases = new AuthUseCases(userRepository);
const userUseCases = new UserUseCases(userRepository);
const companyUseCases = new CompanyUseCases(companyRepository);
const clientUseCases = new ClientUseCases(clientRepository, companyRepository);
const driverUseCases = new DriverUseCases(driverRepository, companyRepository);
const remisionUseCases = new RemisionUseCases(remisionRepository, companyRepository);

// Controladores (presentación)
export const authController = new AuthController(authUseCases);
export const userController = new UserController(userUseCases);
export const companyController = new CompanyController(companyUseCases);
export const clientController = new ClientController(clientUseCases);
export const driverController = new DriverController(driverUseCases);
export const remisionController = new RemisionController(remisionUseCases);
