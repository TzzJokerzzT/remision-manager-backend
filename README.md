# Remisiones Backend

API REST para generador de remisiones (con precio + IVA, o solo cantidad). Construido con **Bun + Express + TypeScript**, siguiendo **Clean Architecture**, con **MongoDB/Mongoose**, autenticación **JWT (access + refresh token con rotación)** y múltiples capas de seguridad.

## Stack

- **Runtime:** Bun
- **Framework:** Express 4
- **Lenguaje:** TypeScript (ESM)
- **DB:** MongoDB + Mongoose
- **Validación:** Zod
- **Auth:** JWT (access + refresh), bcryptjs

## Arquitectura (Clean Architecture)

```
src/
  domain/            → Entidades e interfaces de repositorio (sin dependencias externas)
    entities/
    repositories/
  application/        → Casos de uso + DTOs (reglas de negocio)
    use-cases/
    dtos/
  infrastructure/      → Implementaciones concretas (Mongo, JWT, bcrypt)
    database/
    repositories/
    security/
  presentation/        → Express: controllers, routes, middlewares
    http/
  di/                 → Contenedor de inyección de dependencias (cablea todo)
  config/             → Variables de entorno (validadas con Zod)
  shared/             → Errores comunes, utilidades
```

La regla de dependencia: `domain` no depende de nada. `application` depende solo de `domain`. `infrastructure` y `presentation` dependen de `application`/`domain`, nunca al revés. Esto permite cambiar Mongo por Postgres, o Express por Fastify, sin tocar la lógica de negocio.

## Seguridad implementada

- **Helmet**: cabeceras HTTP seguras.
- **CORS** restringido por whitelist de orígenes (`CORS_ORIGINS` en `.env`).
- **express-mongo-sanitize**: limpia `req.body/query/params` de operadores Mongo (`$ne`, `$gt`, `$where`, etc.) para prevenir **NoSQL injection** (Mongo no usa SQL, por lo que la protección relevante es contra inyección de operadores, no inyección SQL clásica).
- **hpp**: previene HTTP Parameter Pollution.
- **Zod** en cada endpoint: valida y sanea tipos, formatos y longitudes antes de tocar la base de datos.
- **Mongoose `strict: true`**: descarta cualquier campo no declarado en el schema.
- **Rate limiting**: límite general + límite estricto en `/api/auth/*` contra fuerza bruta.
- **bcryptjs** (12 salt rounds) para contraseñas.
- **JWT access token** de corta duración (15 min por defecto) + **refresh token** (7 días) con **rotación**: cada refresh invalida el anterior (se guarda solo el hash SHA-256 del refresh token vigente en BD, nunca el token en texto plano).
- **Autorización por rol** (`admin` / `user`) vía middleware `authorize()`.
- **Ownership check**: un usuario `user` solo puede ver/editar sus propios recursos (empresas, clientes, conductores, remisiones); `admin` puede ver todo.
- Límite de tamaño de payload JSON (1mb) para mitigar payloads abusivos.

## Configuración

```bash
cp .env.example .env
# Edita .env con tus valores reales, especialmente:
# - MONGO_URI
# - JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (mínimo 32 caracteres, usa algo random fuerte)
# - CORS_ORIGINS (dominios de tu frontend)
```

## Instalación y ejecución

```bash
bun install
bun run dev     # desarrollo con watch
bun run start   # producción
bun run build   # solo type-check (tsc --noEmit)
```

## Endpoints

### Auth — `/api/auth`
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/register` | Registro de usuario (el primer usuario creado queda como `admin`) | No |
| POST | `/login` | Login | No |
| POST | `/refresh` | Renueva access/refresh token (rotación) | No (requiere refreshToken válido) |
| POST | `/logout` | Invalida el refresh token actual | Sí |

### Usuarios — `/api/users`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Perfil propio |
| GET | `/` | Listar usuarios (solo admin) |
| GET | `/:id` | Obtener usuario |
| PATCH | `/:id` | Actualizar usuario (nombre, `companyLogoUrl`, `isActive`) |
| DELETE | `/:id` | Eliminar usuario |

> El logo de la empresa a nivel de usuario se gestiona con el campo `companyLogoUrl` vía `PATCH /api/users/:id`. Sube la imagen a tu storage (S3, Cloudinary, etc.) desde el frontend y guarda aquí la URL resultante.

### Empresas — `/api/companies`
CRUD completo: `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`

### Clientes — `/api/clients`
CRUD completo. `POST /` requiere `companyId`. `GET /?companyId=...` filtra por empresa.

### Conductores — `/api/drivers`
CRUD completo. Mismo patrón que clientes.

### Remisiones — `/api/remisiones`
CRUD completo. `type: "priced"` calcula `subtotal`, `ivaValue` y `total` automáticamente a partir de `items` e `ivaPercentage`. `type: "quantity_only"` omite esos cálculos. El campo `consecutive` se autogenera por empresa.

Todas las rutas (excepto `/register`, `/login`, `/refresh`) requieren el header:
```
Authorization: Bearer <accessToken>
```

## Notas de diseño

- El primer usuario registrado en el sistema se vuelve `admin` automáticamente; los siguientes son `user`. Ajusta esta regla en `AuthUseCases.register` según tus necesidades reales (por ejemplo, invitaciones por admin).
- Los modelos usan `_id` de Mongo como identificador; las entidades de dominio exponen `id: string`.
- Los repositorios implementan interfaces del dominio (`IUserRepository`, etc.), lo que permite mockearlos fácilmente en tests unitarios de los casos de uso.
