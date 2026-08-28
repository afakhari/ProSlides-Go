# ProSlides

ProSlides is a capacity-oriented interactive presentation platform for quizzes,
polls, word clouds, Q&A, live sessions, scoring, and reports.

## Architecture

```text
apps/web  → React 19 + Vite (incremental JavaScript → TypeScript migration)
apps/api  → Go modular monolith + REST + SSE
             ↓
        PostgreSQL + Redis
```

The backend uses HTTP POST for commands and Server-Sent Events for live
server-to-client updates. PostgreSQL is the durable source of truth. Redis
currently provides readiness and distributed identity rate limits; future live
fan-out/presence acceleration must remain ephemeral.

## Repository layout

- `apps/api` — Go API, SQL migrations, and OpenAPI contract.
- `apps/web` — React client using the Go cookie API and snapshot-first SSE.
- `docs` — backend/capacity architecture, frontend target architecture, UX
  phases, runbooks, evidence, and architectural decisions.
- `AGENTS.md` — mandatory development context and update protocol.

## Local stack

Install Docker Desktop with Compose v2 and run:

```powershell
docker compose --env-file apps/api/.env.example up --build -d
```

Open the complete application at `http://localhost:5173`. The UI container
serves the production React build and proxies `/api/v1` to Go. Direct API
health is `http://localhost:8080/healthz`; readiness is
`http://localhost:8080/readyz` and requires PostgreSQL and Redis.

For direct Go development, install the version declared in `apps/api/go.mod`,
then run `go test ./...` from `apps/api`.

Use [the documentation map](docs/README.md) to find the authoritative document
for each question. Use [the local runbook](docs/local-development.md) for hot reload, verification,
ports, provider behavior, and troubleshooting. Use [the deployment
runbook](docs/deployment-runbook.md) and [operations
runbook](docs/operations-runbook.md) for immutable images, TLS/SSE proxying,
migrations, backup/restore, and rollback.

## Development rules

Read [AGENTS.md](AGENTS.md) before making a change. API and SSE contract changes
start in `apps/api/openapi/openapi.yaml`; after every material change, update
both [AGENTS.md](AGENTS.md) and [the AI execution handoff](docs/AI_HANDOFF.md).
The handoff document defines the exact next task, verification commands, and
completion criteria. See [migration status](docs/migration-status.md) for the
Django/Rust parity matrix and [configuration](docs/configuration.md) for all
runtime settings. Frontend changes must also follow the audited
[frontend architecture](docs/frontend-architecture.md), the
[Persian-first delivery plan](docs/frontend-professionalization.md), and
[ADR 0003](docs/decisions/0003-modular-react-frontend.md).

The current exact next task is frontend F1 creation-to-editor continuity. The
production-like TLS 1k capacity gate remains mandatory and queued after the
owner-prioritized frontend F1-F5 sequence; local 1k results are not production
capacity certification.
