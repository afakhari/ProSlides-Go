# ProSlides Go backend

This is the current Go modular-monolith foundation for ProSlides v2. It
provides identity, owner-scoped Presentation/Content/Activity APIs, durable live
Sessions, idempotent responses, scoring, role-scoped snapshots,
manager-paginated rosters and SSE replay. PostgreSQL uses
`pgxpool` and is authoritative. Redis uses `go-redis` for readiness and
distributed fixed-window identity rate limits, never durable live state.

## Start with Docker Compose

From the repository root:

```sh
docker compose --env-file apps/api/.env.example up --build
```

Then request:

- `GET http://localhost:8080/healthz` returns process liveness only.
- `GET http://localhost:8080/readyz` returns `200` only when PostgreSQL and
  Redis are reachable; it returns `503` with safe dependency statuses when
  either is unavailable.

## Local development

Install the Go version declared in `go.mod`. For host execution, start
PostgreSQL/Redis, copy `.env.local.example` to the ignored `.env.local`, and use
the repository loader (the Go binary intentionally does not auto-load dotenv):

```sh
go test ./...
powershell -ExecutionPolicy Bypass -File ../../scripts/run-api-local.ps1
```

`DATABASE_URL` and `REDIS_URL` are required in every environment.
`DEPENDENCY_CHECK_TIMEOUT` is a positive Go duration (default `2s`) that bounds
each readiness check. Never place real credentials in `.env.example` or Git.
`MIGRATION_TIMEOUT` separately bounds the locked, transactional startup
migration sequence. All identity, SMTP, Google, proxy, and runtime variables are documented in
[`docs/configuration.md`](../../docs/configuration.md).

API contract changes begin in `openapi/openapi.yaml`. Before v2 work, read the
repository root `AGENTS.md`, `../../docs/status/current.md`,
`../../docs/v2-product-architecture.md` and the active slice in
`../../docs/v2-development-plan.md`.

## Current implementation baseline

Authentication uses opaque server-side sessions and CSRF cookies. Optional
email verification and password reset use hashed one-time secrets and the
configured SMTP adapter; Google ID tokens are verified against signed JWKS
claims. Redis-backed fixed-window limits protect identity entry points. Live manager
commands use HTTP and state versions; participants receive a scoped HttpOnly
cookie. The SSE endpoint supports durable `Last-Event-ID` replay and sends
canonical aggregate Activity-result/ranking events rather than one event per
response or one full-roster event. Choice scoring is behind `ScoringPolicy`;
the current deduction policy supports partial credit and can be replaced later.
Result/ranking events use schema version 2; retained pre-v2 ranking arrays are
normalized by migrations and defensively sanitized during replay.

Participant snapshots expose public Session state, the active Item, the caller's
participant/score, aggregate participant count, and `last_event_id`; they never
include the complete roster, score map, or unrevealed Activity correctness metadata.
`GET /api/v1/live/sessions/resolve?join_code=...` maps the public presenter code
to the current non-ended Go live session without exposing manager fields.
Owners set a persistent, case-insensitive unique code with
`PUT /api/v1/presentations/{presentationId}/access-code`. The API normalizes it
to uppercase and atomically replaces the code on the current non-ended session,
so the old `/{accessCode}` link stops resolving immediately.
Manager snapshots are also bounded.
Managers use `GET /api/v1/live/sessions/{sessionId}/roster` with a maximum
`limit` of 100, opaque keyset cursors, and stable `joined` or `score` ordering.
Owned historical Activity results use the Session-first report boundary
`GET /api/v1/presentations/{presentationId}/sessions/{sessionId}/activities/{activityItemId}/results`.
The response keeps Activity result aggregation, bounded response history and
per-Activity top performers separate from cumulative Session ranking.

Event delivery uses one bounded process-local broker per active session rather
than polling PostgreSQL from every SSE connection. Slow subscribers are closed
and recover from the durable ledger. Snapshots return `last_event_id`, presence
bursts are compacted, and participant scores are maintained atomically for
indexed snapshot/ranking reads. This removes known immediate bottlenecks but
does not certify the 10k target; see `docs/capacity-plan.md` for the required
workload and pass/fail gates.

Run `powershell -ExecutionPolicy Bypass -File scripts/test-auth-integration.ps1`
from the repository root to execute the identity, content, live, scoring,
role-scoped snapshot, paginated roster, per-Activity results, atomic slide
ordering, authorization/non-disclosure, and SSE replay matrix. Use
`-SkipComposeStartup` only for an
already-running local stack and `-StopAfter` only when it is safe to stop it.
