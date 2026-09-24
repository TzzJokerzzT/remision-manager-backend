# SDD Context — remisiones-backend

## Project Identity

- **Name**: remisiones-backend
- **Root**: /home/alex_buelvas/Projects/Github/remisiones-backend
- **Workspace Root**: /home/alex_buelvas/Projects/Github/remisiones-backend
- **Mode**: openspec
- **Strict TDD**: true

## Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Bun | 1.4.2 |
| Language | TypeScript | 5.6.2 (strict) |
| Framework | Express | 4.21.0 |
| Database | MongoDB (Mongoose) | 8.7.0 |
| Validation | Zod | 3.23.8 |
| Auth | JWT (jsonwebtoken) + bcryptjs | 9.0.2 |
| Security | Helmet, CORS, HPP, Rate Limiting, mongo-sanitize | Latest |
| Linter/Formatter | Biome | 2.5.0 |
| Testing | bun:test | built-in |
| Git Hooks | Husky + commitlint | 9.x |
| Deployment | Vercel Serverless (Bun 1.x) | - |

## Architecture

Clean Architecture with four layers:

```
src/
├── config/          # Environment variables (Zod validated)
├── domain/          # Entities, repository interfaces, pure services
│   ├── entities/
│   ├── repositories/
│   └── services/
├── application/     # Use cases and DTOs
│   ├── dtos/
│   └── use-cases/
├── infrastructure/  # Mongoose models, repository impls, security
│   ├── database/
│   ├── repositories/
│   └── security/
├── presentation/    # Express HTTP layer
│   └── http/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       └── server.ts
├── di/              # Dependency injection container
└── shared/          # AppError hierarchy, utilities
```

## Testing Capabilities

| Category | Status | Tool | Command |
|----------|--------|------|---------|
| Unit Tests | ✅ 15 files | bun:test | `bun test` |
| Integration | ❌ None | - | - |
| E2E Tests | ❌ None | - | - |
| Coverage | ✅ Available | bun:test | `bun test --coverage` |
| Linting | ✅ Biome | biome | `biome check .` |
| Type Check | ✅ TypeScript | tsc | `bun run build` |
| Formatting | ✅ Biome | biome | `biome format .` |

**Strict TDD**: Enabled (`bun test` covers the workspace)

## Conventions

- **Module System**: ES Modules (type: "module")
- **TypeScript**: Strict mode enabled
- **Formatting**: Tab indentation, double quotes
- **Imports**: Relative with `.js` extension
- **Validation**: Zod schemas for all DTOs
- **Auth**: JWT (access 15min + refresh 7d with rotation)
- **Git Hooks**: typecheck → lint → test → build on pre-commit
- **Commits**: Conventional Commits enforced by commitlint

## Commands

```bash
bun run dev           # Development with hot reload
bun run start         # Production
bun run build         # Type check (tsc --noEmit)
bun test              # Run all tests
bun test --coverage   # Tests with coverage
bun run lint          # Biome check
bun run format        # Biome format
```

## Engram Observations

- **ID**: 1250 (initial, stale)
- **Topic**: sdd-init/remisiones-backend
- **Type**: architecture

## Risks

1. **No integration tests**: All 15 tests are unit tests with mocks
2. **No E2E tests**: No HTTP-level testing
3. **Stale context**: Previous context.md had incorrect testing status (now corrected)
4. **No .env.example**: Environment variables documented only in README

## Next Steps

1. Use `/sdd-explore` to analyze a specific improvement area
2. Use `/sdd-new` to propose a change (e.g., integration tests, CI/CD)
3. Existing changes in `openspec/changes/`: api-pagination, remision-search, testing-infrastructure
