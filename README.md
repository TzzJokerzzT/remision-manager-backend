# Remisiones Backend

API REST para generador de remisiones (con precio + IVA, o solo cantidad). Construido con **Bun + Express + TypeScript**, siguiendo **Clean Architecture**, con **MongoDB/Mongoose**, autenticación **JWT (access + refresh token con rotación)** y múltiples capas de seguridad.

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | Bun | 1.x |
| Framework | Express | 4.x |
| Lenguaje | TypeScript | 5.x (ESM) |
| Base de datos | MongoDB + Mongoose | 8.x |
| Validación | Zod | 3.x |
| Auth | JWT (access + refresh) + bcryptjs | — |
| Seguridad | Helmet, CORS, HPP, mongo-sanitize, rate-limit | — |
| Linter/Formatter | Biome | 2.5 |
| Testing | Bun test | — |
| Git hooks | Husky + commitlint | 9.x |
| Despliegue | Vercel (serverless) | — |

---

## Arquitectura — Clean Architecture

El proyecto sigue **Clean Architecture** con separación estricta de responsabilidades. La regla fundamental: **`domain` no depende de nada. `application` depende solo de `domain`. `infrastructure` y `presentation` dependen de `application`/`domain`, nunca al revés.**

Esto permite cambiar Mongo por Postgres, o Express por Fastify, sin tocar la lógica de negocio.

```
src/
├── config/                  → Variables de entorno (validadas con Zod)
│   └── env.ts
│
├── domain/                  → Entidades e interfaces de repositorio (SIN dependencias externas)
│   ├── entities/
│   │   ├── User.ts
│   │   ├── Company.ts
│   │   ├── Client.ts
│   │   ├── Driver.ts
│   │   └── Remision.ts
│   └── repositories/
│       ├── IUserRepository.ts
│       ├── ICompanyRepository.ts
│       ├── IClientRepository.ts
│       ├── IDriverRepository.ts
│       └── IRemisionRepository.ts
│   └── services/
│       └── remisionTotals.ts
│
├── application/             → Casos de uso + DTOs (reglas de negocio)
│   ├── use-cases/
│   │   ├── auth/AuthUseCases.ts
│   │   ├── user/UserUseCases.ts
│   │   ├── company/CompanyUseCases.ts
│   │   ├── client/ClientUseCases.ts
│   │   ├── driver/DriverUseCases.ts
│   │   └── remision/RemisionUseCases.ts
│   └── dtos/
│       ├── auth.dto.ts
│       ├── user.dto.ts
│       ├── company.dto.ts
│       ├── client.dto.ts
│       ├── driver.dto.ts
│       ├── remision.dto.ts
│       ├── pagination.dto.ts
│       └── remision-list-query.dto.ts
│
├── infrastructure/          → Implementaciones concretas (Mongo, JWT, bcrypt)
│   ├── database/
│   │   ├── mongoose.ts          (conexión)
│   │   └── models/
│   │       ├── User.model.ts
│   │       ├── Company.model.ts
│   │       ├── Client.model.ts
│   │       ├── Driver.model.ts
│   │       └── Remision.model.ts
│   ├── repositories/
│   │   ├── UserRepository.ts
│   │   ├── CompanyRepository.ts
│   │   ├── ClientRepository.ts
│   │   ├── DriverRepository.ts
│   │   └── RemisionRepository.ts
│   └── security/
│       ├── jwt.service.ts
│       ├── password.service.ts
│       └── hash.util.ts
│
├── presentation/            → Express: controllers, routes, middlewares
│   └── http/
│       ├── server.ts             (Express app + middlewares + rutas)
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── user.controller.ts
│       │   ├── company.controller.ts
│       │   ├── client.controller.ts
│       │   ├── driver.controller.ts
│       │   └── remision.controller.ts
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── user.routes.ts
│       │   ├── company.routes.ts
│       │   ├── client.routes.ts
│       │   ├── driver.routes.ts
│       │   └── remision.routes.ts
│       └── middlewares/
│           ├── authenticate.ts
│           ├── authorize.ts
│           ├── validate.ts
│           ├── errorHandler.ts
│           └── rateLimiter.ts
│
├── di/                      → Contenedor de inyección de dependencias (cablea todo)
│   └── container.ts
│
├── shared/                  → Errores comunes, utilidades
│   ├── errors/AppError.ts
│   └── utils/escape-regex.ts
│
└── index.ts                 → Entry point
```

> **Path aliases**: los imports usan el alias `@/*` → `src/*` (ej. `@/domain/entities/User.js`), configurado en `tsconfig.json` (`paths`). Los tests viven co-ubicados junto a su código (`*.test.ts`).

---

## Seguridad Implementada

- **Helmet**: cabeceras HTTP seguras.
- **CORS** restringido por whitelist de orígenes (`CORS_ORIGINS` en `.env`).
- **express-mongo-sanitize**: limpia `req.body/query/params` de operadores Mongo (`$ne`, `$gt`, `$where`, etc.) para prevenir **NoSQL injection**.
- **hpp**: previene HTTP Parameter Pollution.
- **Zod** en cada endpoint: valida y sanea tipos, formatos y longitudes antes de tocar la base de datos.
- **Mongoose `strict: true`**: descarta cualquier campo no declarado en el schema.
- **Rate limiting**: límite general + límite estricto en `/api/auth/*` contra fuerza bruta.
- **bcryptjs** (12 salt rounds) para contraseñas.
- **JWT access token** de corta duración (15 min por defecto) + **refresh token** (7 días) con **rotación**.
- **Autorización por rol** (`admin` / `user`) vía middleware `authorize()`.
- **Ownership check**: un usuario `user` solo puede ver/editar sus propios recursos; `admin` puede ver todo.
- Límite de tamaño de payload JSON (1mb).

---

## Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
NODE_ENV=development
PORT=3000

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>

# JWT (mínimo 32 caracteres cada uno)
JWT_ACCESS_SECRET=<secret-fuerte-min-32chars>
JWT_REFRESH_SECRET=<secret-fuerte-min-32chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS (dominios del frontend, separados por coma)
CORS_ORIGINS=http://localhost:3000,https://tu-dominio.com

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
```

---

## Instalación y Ejecución

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd remisiones-backend

# 2. Instalar dependencias
bun install

# 3. Configurar variables de entorno
cp .env.example .env   # o crea .env manualmente
# Edita .env con tus valores reales

# 4. Ejecutar
bun run dev      # desarrollo con hot-reload
bun run start    # producción
bun run build    # type-check (tsc --noEmit)
```

**Requisitos previos:**
- [Bun](https://bun.sh/) instalado (v1.x)
- MongoDB accesible (local o Atlas)

---

## Scripts, Testing y Linting

Scripts disponibles:

```bash
bun run dev           # desarrollo con hot-reload
bun run start         # producción
bun run build         # type-check (tsc --noEmit)
bun run typecheck     # alias de build (tsc --noEmit)
bun test              # ejecutar tests (bun test)
bun run test:watch    # tests en modo watch
bun run test:coverage # tests con cobertura
bun run lint          # biome check .
bun run format        # biome format .
```

### Git Hooks (Husky)

Al hacer `git commit` se ejecutan automáticamente, en este orden:

1. **Typecheck** — `bun run typecheck`
2. **Linter** — `bun run lint`
3. **Tests** — `bun test`
4. **Build** — `bun run build`

Además, `commitlint` valida que el mensaje siga **Conventional Commits** (`feat:`, `fix:`, `chore:`, `style:`, `refactor:`, `test:`, `docs:`, etc.).

---

## Endpoints

Todas las rutas (excepto `/register`, `/login`, `/refresh`) requieren el header:
```
Authorization: Bearer <accessToken>
```

### Health Check

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/health` | Estado del servidor | No |

### Auth — `/api/auth`

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/register` | Registro de usuario (el primero queda como `admin`) | No |
| POST | `/login` | Login (retorna accessToken + refreshToken) | No |
| POST | `/refresh` | Renueva tokens (rotación) | No (requiere refreshToken) |
| POST | `/logout` | Invalida el refresh token actual | Sí |

### Usuarios — `/api/users`

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/me` | Perfil del usuario autenticado | Sí |
| GET | `/` | Listar todos los usuarios | Sí (admin) |
| GET | `/:id` | Obtener usuario por ID | Sí |
| PATCH | `/:id` | Actualizar usuario (nombre, logo, isActive) | Sí |
| DELETE | `/:id` | Eliminar usuario | Sí |

### Empresas — `/api/companies`

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/` | Crear empresa | Sí |
| GET | `/` | Listar empresas del usuario | Sí |
| GET | `/:id` | Obtener empresa por ID | Sí |
| PATCH | `/:id` | Actualizar empresa | Sí |
| DELETE | `/:id` | Eliminar empresa | Sí |

### Clientes — `/api/clients`

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/` | Crear cliente (requiere `companyId`) | Sí |
| GET | `/` | Listar clientes (filtro: `?companyId=...`) | Sí |
| GET | `/:id` | Obtener cliente por ID | Sí |
| PATCH | `/:id` | Actualizar cliente | Sí |
| DELETE | `/:id` | Eliminar cliente | Sí |

### Conductores — `/api/drivers`

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/` | Crear conductor (requiere `companyId`) | Sí |
| GET | `/` | Listar conductores (filtro: `?companyId=...`) | Sí |
| GET | `/:id` | Obtener conductor por ID | Sí |
| PATCH | `/:id` | Actualizar conductor | Sí |
| DELETE | `/:id` | Eliminar conductor | Sí |

### Remisiones — `/api/remisiones`

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/` | Crear remisión | Sí |
| GET | `/` | Listar remisiones (paginado) | Sí |
| GET | `/:id` | Obtener remisión por ID | Sí |
| PATCH | `/:id` | Actualizar remisión | Sí |
| DELETE | `/:id` | Eliminar remisión | Sí |

**Tipos de remisión:**
- `priced`: calcula `subtotal`, `ivaValue` y `total` automáticamente a partir de `items` e `ivaPercentage`.
- `quantity_only`: omite esos cálculos (solo registra cantidades).

El campo `consecutive` se autogenera por empresa.

### Paginación y filtros

Los endpoints `GET /` de empresas, clientes, conductores y remisiones soportan **paginación**:

| Param | Default | Descripción |
|---|---|---|
| `limit` | 20 (remisiones) / 10 (empresas, clientes, conductores) | Registros por página (máx. 100) |
| `page` | 1 | Número de página |

La respuesta paginada tiene la forma `{ items, total, limit, page, totalPages }`.

`GET /api/remisiones` acepta además **filtros de búsqueda** (componibles entre sí y con la paginación):

| Param | Descripción |
|---|---|
| `search` | Búsqueda de texto sobre las **notas** de la remisión |
| `clientName` | Substring (case-insensitive) sobre el nombre del cliente |
| `driverName` | Substring (case-insensitive) sobre el nombre del conductor |
| `type` | `priced` o `quantity_only` |
| `from` / `to` | Rango sobre `createdAt` (inclusivo; `to` con solo fecha = fin de día UTC) |
| `companyId` | Filtrar por empresa |

Cada remisión en la respuesta incluye el campo `clientName`.

Ejemplo:

```
GET /api/remisiones?companyId=6a399e6253da3bf3c3021049&clientName=TMR&type=priced&from=2026-01-01&to=2026-01-31&page=1&limit=10
```

---

## Cómo Crear una Nueva Feature

Para agregar una nueva entidad (ej. `Vehicle`) al proyecto, sigue estos pasos:

> **Nota**: los ejemplos usan imports relativos por brevedad. El código real del proyecto usa el alias `@/*` → `src/*` (ej. `import type { Vehicle } from "@/domain/entities/Vehicle.js"`).

### 1. Dominio — Entidad

Crea la interfaz de la entidad en `src/domain/entities/Vehicle.ts`:

```typescript
export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  companyId: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Dominio — Interfaz del Repositorio

Crea la interfaz en `src/domain/repositories/IVehicleRepository.ts`:

```typescript
import type { Vehicle } from "../entities/Vehicle.js";

export interface IVehicleRepository {
  create(data: Omit<Vehicle, "id" | "createdAt" | "updatedAt">): Promise<Vehicle>;
  findById(id: string, ownerId: string): Promise<Vehicle | null>;
  findAll(ownerId: string, filters?: { companyId?: string }): Promise<Vehicle[]>;
  update(id: string, ownerId: string, data: Partial<Vehicle>): Promise<Vehicle | null>;
  delete(id: string, ownerId: string): Promise<boolean>;
}
```

### 3. Infraestructura — Modelo Mongoose

Crea el schema en `src/infrastructure/database/models/Vehicle.model.ts`:

```typescript
import mongoose, { Schema, type Document } from "mongoose";

export interface VehicleDocument extends Document {
  plate: string;
  brand: string;
  model: string;
  companyId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
}

const vehicleSchema = new Schema<VehicleDocument>(
  {
    plate: { type: String, required: true, uppercase: true, trim: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const VehicleModel = mongoose.model<VehicleDocument>("Vehicle", vehicleSchema);
```

### 4. Infraestructura — Repositorio

Implementa la interfaz en `src/infrastructure/repositories/VehicleRepository.ts`:

```typescript
import type { IVehicleRepository } from "../../domain/repositories/IVehicleRepository.js";
import { VehicleModel } from "../database/models/Vehicle.model.js";

export class VehicleRepository implements IVehicleRepository {
  async create(data) {
    const doc = await VehicleModel.create(data);
    return { ...doc.toObject(), id: doc._id.toString() };
  }
  // ... implementar los demás métodos
}
```

### 5. Aplicación — DTOs

Crea el DTO de validación en `src/application/dtos/vehicle.dto.ts`:

```typescript
import { z } from "zod";

export const createVehicleSchema = z.object({
  plate: z.string().trim().min(1).max(10).toUpperCase(),
  brand: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  companyId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

export const updateVehicleSchema = z.object({
  plate: z.string().trim().min(1).max(10).toUpperCase().optional(),
  brand: z.string().trim().min(1).max(50).optional(),
  model: z.string().trim().min(1).max(50).optional(),
});
```

### 6. Aplicación — Caso de Uso

Crea el caso de uso en `src/application/use-cases/vehicle/VehicleUseCases.ts`:

```typescript
import type { IVehicleRepository } from "../../../domain/repositories/IVehicleRepository.js";
import type { CreateVehicleDto, UpdateVehicleDto } from "../../dtos/vehicle.dto.js";
import { NotFoundError } from "../../../shared/errors/AppError.js";

export class VehicleUseCases {
  constructor(private readonly vehicleRepo: IVehicleRepository) {}

  async create(dto: CreateVehicleDto, ownerId: string) {
    return this.vehicleRepo.create({ ...dto, ownerId } as any);
  }

  async list(ownerId: string, companyId?: string) {
    return this.vehicleRepo.findAll(ownerId, { companyId });
  }

  async getById(id: string, ownerId: string) {
    const vehicle = await this.vehicleRepo.findById(id, ownerId);
    if (!vehicle) throw new NotFoundError("Vehículo");
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, ownerId: string) {
    const vehicle = await this.vehicleRepo.update(id, ownerId, dto as any);
    if (!vehicle) throw new NotFoundError("Vehículo");
    return vehicle;
  }

  async delete(id: string, ownerId: string) {
    const deleted = await this.vehicleRepo.delete(id, ownerId);
    if (!deleted) throw new NotFoundError("Vehículo");
  }
}
```

### 7. Presentación — Controller

Crea el controller en `src/presentation/http/controllers/vehicle.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import type { VehicleUseCases } from "../../../application/use-cases/vehicle/VehicleUseCases.js";
import type { AuthenticatedRequest } from "../middlewares/authenticate.js";

export class VehicleController {
  constructor(private readonly vehicleUseCases: VehicleUseCases) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vehicle = await this.vehicleUseCases.create(req.body, req.user!.id);
      res.status(201).json({ success: true, data: vehicle });
    } catch (err) { next(err); }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { companyId } = req.query;
      const vehicles = await this.vehicleUseCases.list(req.user!.id, companyId as string);
      res.json({ success: true, data: vehicles });
    } catch (err) { next(err); }
  };

  // ... getById, update, delete siguen el mismo patrón
}
```

### 8. Presentación — Rutas

Crea las rutas en `src/presentation/http/routes/vehicle.routes.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { createVehicleSchema, updateVehicleSchema } from "../../../application/dtos/vehicle.dto.js";
import { mongoIdSchema } from "../../../application/dtos/user.dto.js";
import type { VehicleController } from "../controllers/vehicle.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";

export function buildVehicleRoutes(controller: VehicleController): Router {
  const router = Router();
  const idParamSchema = z.object({ id: mongoIdSchema });

  router.use(authenticate);

  router.post("/", validate(createVehicleSchema), controller.create);
  router.get("/", controller.list);
  router.get("/:id", validate(idParamSchema, "params"), controller.getById);
  router.patch("/:id", validate(idParamSchema, "params"), validate(updateVehicleSchema), controller.update);
  router.delete("/:id", validate(idParamSchema, "params"), controller.delete);

  return router;
}
```

### 9. DI Container — Cablear todo

Agrega en `src/di/container.ts`:

```typescript
import { VehicleRepository } from "../infrastructure/repositories/VehicleRepository.js";
import { VehicleUseCases } from "../application/use-cases/vehicle/VehicleUseCases.js";
import { VehicleController } from "../presentation/http/controllers/vehicle.controller.js";

const vehicleRepository = new VehicleRepository();
const vehicleUseCases = new VehicleUseCases(vehicleRepository);
export const vehicleController = new VehicleController(vehicleUseCases);
```

### 10. Server — Registrar la ruta

En `src/presentation/http/server.ts`:

```typescript
import { vehicleController } from "../../di/container.js";
import { buildVehicleRoutes } from "./routes/vehicle.routes.js";

// Dentro de createServer():
app.use("/api/vehicles", buildVehicleRoutes(vehicleController));
```

### 11. Verificar

```bash
bun run build   # type-check — debe pasar sin errores
bun run dev     # probar los endpoints manualmente o con Postman
```

**Resumen del flujo:**

```
Entity (domain) → Repository Interface (domain) → Mongoose Model (infra)
→ Repository Implementation (infra) → DTOs (application)
→ Use Cases (application) → Controller (presentation)
→ Routes (presentation) → DI Container → Server
```

---

## Notas de Diseño

- El primer usuario registrado se vuelve `admin` automáticamente; los siguientes son `user`.
- Los modelos usan `_id` de Mongo como identificador; las entidades de dominio exponen `id: string`.
- Los repositorios implementan interfaces del dominio, lo que permite mockearlos fácilmente en tests unitarios.
- Los imports usan el alias `@/*` → `src/*` (definido en `tsconfig.json` bajo `compilerOptions.paths`).
- El DTO `pagination.dto.ts` define la estructura estándar de respuesta paginada: `{ items, total, limit, page, totalPages }`.
- El cálculo de totales de la remisión vive en `src/domain/services/remisionTotals.ts` (función pura `computeRemisionTotals`).
- La búsqueda por nombre de cliente/conductor usa una resolución en dos pasos: regex escapado sobre `name` → ids → `$in` sobre `clientId`/`driverId`.

---

## Licencia

ISC
