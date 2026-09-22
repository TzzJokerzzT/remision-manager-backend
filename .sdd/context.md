# SDD Context — remisiones-backend

## Project Identity

- **Name**: remisiones-backend
- **Root**: /home/alex_buelvas/Projects/Github/remisiones-backend/remisiones-backend
- **Workspace Root**: /home/alex_buelvas/Projects/Github/remisiones-backend
- **Mode**: hybrid (Engram + openspec)
- **Strict TDD**: false

## Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Bun | 1.x |
| Language | TypeScript | 5.6.2 |
| Framework | Express | 4.21.0 |
| Database | MongoDB (Mongoose) | 8.7.0 |
| Validation | Zod | 3.23.8 |
| Auth | JWT (jsonwebtoken) | 9.0.2 |
| Security | Helmet, CORS, HPP, Rate Limiting | Latest |
| Linter | Biome | 2.5.0 |
| Deployment | Vercel Serverless | - |

## Architecture

Clean Architecture with four layers:

```
src/
├── domain/          # Entities and repository interfaces
│   ├── entities/
│   └── repositories/
├── application/     # Use cases and DTOs
│   ├── dtos/
│   └── use-cases/
├── infrastructure/  # Database, security implementations
│   ├── database/
│   ├── repositories/
│   └── security/
├── presentation/    # HTTP layer
│   └── http/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       └── server.ts
├── config/          # Environment configuration
├── di/              # Dependency injection container
└── shared/          # Shared utilities
```

## Testing Capabilities

| Category | Status | Runner | Command |
|----------|--------|--------|---------|
| Unit Tests | ❌ None | - | - |
| Integration | ❌ None | - | - |
| E2E Tests | ❌ None | - | - |
| Coverage | ❌ None | - | - |
| Linting | ✅ Biome | biome | `bunx biome check .` |
| Type Check | ✅ TypeScript | tsc | `bun run build` |

**Strict TDD**: Disabled (no test runner configured)

## Conventions

- **Module System**: ES Modules (type: "module")
- **TypeScript**: Strict mode enabled
- **Formatting**: Tab indentation, double quotes
- **Path Aliases**: `@/*` → `src/*`
- **Validation**: Zod schemas for DTOs
- **Auth**: JWT tokens with bcryptjs for passwords
- **Deployment**: Vercel serverless with Bun runtime

## Commands

```bash
# Development
bun run dev          # Start dev server with hot reload

# Production
bun run start        # Start production server
bun run build        # Type check (noEmit)
bun run lint         # Run ESLint (if configured)

# Testing (NOT CONFIGURED)
# No test scripts defined in package.json
```

## Engram Observations

- **ID**: 1250
- **Topic**: sdd-init/remisiones-backend
- **Type**: architecture
- **Status**: active

## Risks

1. **No Test Framework**: Project has zero test files and no test runner configured
2. **No Test Scripts**: package.json lacks test-related scripts
3. **No Coverage Tool**: No code coverage configured
4. **Biome vs ESLint**: package.json references ESLint but Biome is configured

## Next Steps

1. Configure a test framework (recommended: Bun's built-in test runner or Vitest)
2. Add test scripts to package.json
3. Create test directory structure
4. Write first unit tests for domain entities
5. Set up test database configuration
