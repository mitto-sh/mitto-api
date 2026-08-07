# mitto-api

REST API — the core backend of the Mitto platform.

Handles: projects, services, deployments, environment variables, custom domains, billing, and authentication.

## Responsibilities
- Project and service CRUD
- Deployment lifecycle management
- Environment variable management (encrypted at rest)
- Custom domain + SSL provisioning
- Billing and usage tracking
- Auth (JWT + GitHub/GitLab OAuth)

## Stack
> TBD — see issues

## Getting Started
```bash
cp .env.example .env
docker compose up
```

## Related Services
- [mitto-build](../mitto-build) — builds Docker images
- [mitto-orchestrator](../mitto-orchestrator) — provisions infrastructure
- [mitto-worker](../mitto-worker) — processes async jobs
