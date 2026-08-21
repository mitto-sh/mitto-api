# mitto-api

REST API — the core backend of the Mitto platform.

Handles: projects, services, deployments, environment variables, custom domains, billing, and authentication.

## Responsibilities
- Project and service CRUD
- Per-project environments (production/dev + custom, auto-seeded on project creation)
- Deployment lifecycle management, scoped per environment
- Environment variable management (encrypted at rest, scoped per environment)
- Custom domain + SSL provisioning
- Billing and usage tracking
- Auth (JWT + GitHub/GitLab OAuth)

## Stack
> TBD — see issues

## Getting Started
```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run dev
```

## Testing
```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report — gated at 85% (lines/statements/functions/branches)
```
Tests run against the local Postgres/Redis from `docker compose up -d postgres redis` — no mocking of the database.

## Related Services
- [mitto-build](../mitto-build) — builds Docker images
- [mitto-orchestrator](../mitto-orchestrator) — provisions infrastructure
- [mitto-worker](../mitto-worker) — processes async jobs
