# ProSlides

ProSlides is an interactive presentation platform for quizzes, polls, live
sessions, scoring and reports.

## Architecture

```text
apps/web  -> React + Vite SPA
apps/api  -> Go modular monolith + HTTP + SSE
                |
         PostgreSQL + Redis
```

PostgreSQL is the durable source of truth. Client commands use HTTP; live
server-to-client updates use SSE. Redis provides readiness/rate-limit support
and may accelerate ephemeral work, but it is not a durable answer/event ledger.

## Repository

- `apps/api` — Go API, migrations and OpenAPI contract.
- `apps/web` — React client using cookie auth and snapshot-first SSE.
- `load/k6` — protocol load scenario and reconciliation tooling.
- `docs` — architecture, decisions, current status, runbooks and evidence.
- `AGENTS.md` — repository-wide engineering rules.

Current implementation status and active priorities live only in
[docs/status/current.md](docs/status/current.md).

## Local stack

With Docker Compose v2:

```powershell
docker compose --env-file apps/api/.env.example up --build -d
```

Open `http://localhost:5173`. Direct API liveness is
`http://localhost:8080/healthz`; readiness is
`http://localhost:8080/readyz`.

For hot reload, verification, provider configuration and troubleshooting, use
[docs/local-development.md](docs/local-development.md).

## Development

Read [AGENTS.md](AGENTS.md) before changing the repository. External API/SSE
changes start in `apps/api/openapi/openapi.yaml`. Frontend work follows
[frontend architecture](docs/frontend-architecture.md),
[frontend product guidelines](docs/frontend-professionalization.md) and
[ADR 0003](docs/decisions/0003-modular-react-frontend.md).

Use [docs/README.md](docs/README.md) as the documentation authority map.
Deployment and operations procedures are in
[deployment-runbook.md](docs/deployment-runbook.md) and
[operations-runbook.md](docs/operations-runbook.md).
