# ProSlides

ProSlides is a pre-production interactive-presentation platform for live audience
participation, scoring and session reporting.

## Architecture

```text
apps/web  -> React + Vite TypeScript SPA
apps/api  -> Go modular monolith + HTTP + SSE
                |
         PostgreSQL + Redis
```

PostgreSQL is the durable source of truth. Browser commands and queries use
HTTP; server-to-client live updates use SSE. Redis supports operational/
ephemeral concerns and is never the durable response, score or event ledger.

## ProSlides v2

The active product generation is ProSlides v2. It is an incremental redesign of
the existing system, not a rewrite.

Read:

- [current status](docs/status/current.md);
- [v2 product architecture](docs/v2-product-architecture.md);
- [v2 development plan](docs/v2-development-plan.md);
- [ADR 0004](docs/decisions/0004-v2-activity-session-model.md).

v2.0 is intentionally scoped to presenter-paced individual participation. Team
mode and self-paced/assignment delivery are not part of the current program.

## Repository

- `apps/api` — Go API, migrations and OpenAPI contract.
- `apps/web` — React/Vite TypeScript client.
- `load/k6` — live-protocol load/reconciliation tooling.
- `docs` — architecture, current state, plans, runbooks and evidence.
- `AGENTS.md` — repository-wide engineering rules.

Use [docs/README.md](docs/README.md) as the documentation authority map.

## Local stack

With Docker Compose v2:

```powershell
docker compose --env-file apps/api/.env.example up --build -d
```

Open `http://localhost:5173`. Direct API liveness is
`http://localhost:8080/healthz`; readiness is
`http://localhost:8080/readyz`.

For hot reload and verification use
[docs/local-development.md](docs/local-development.md).

## Development

Read [AGENTS.md](AGENTS.md) before changing the repository. External REST/SSE
contract changes start in `apps/api/openapi/openapi.yaml`.

Frontend technical and UX rules live in
[frontend architecture](docs/frontend-architecture.md) and
[frontend product guidelines](docs/frontend-professionalization.md).
Deferred frontend debt is kept in
[frontend debt](docs/frontend-debt.md).

Deployment and operations procedures are in
[deployment-runbook.md](docs/deployment-runbook.md) and
[operations-runbook.md](docs/operations-runbook.md).

## Security

Report potential vulnerabilities through GitHub's private vulnerability
reporting flow. Do not disclose vulnerability details in public issues or pull
requests. See [.github/SECURITY.md](.github/SECURITY.md).
