# ProSlides engineering rules

This is the mandatory repository-wide guide for humans and coding agents. Keep
it short and durable. Current status belongs in `docs/status/current.md`;
historical work belongs in Git/evidence/archive documents.

## Read order

1. this file;
2. `docs/status/current.md`;
3. architecture/ADR/OpenAPI for the scope;
4. code and tests in scope;
5. runbooks/evidence only when relevant.

## Non-negotiable architecture

- Backend: Go modular monolith.
- Durable data: PostgreSQL.
- Redis is not a durable command/answer/score/event source.
- Client commands use HTTP; server-to-client live delivery uses SSE.
- A WebSocket, broker, microservice, Kubernetes, or new datastore requires a
  documented measured need rather than anticipated scale.
- Frontend target: modular TypeScript SPA with `app -> modules -> shared`.
- Live frontend state remains a dedicated typed snapshot/command/SSE runtime,
  not a generic REST cache.

## Correctness invariants

- HTTP mutation success is definitive; clients do not wait for an SSE echo.
- Live retries reuse stable `request_id`; manager commands also use the latest
  `expected_state_version`.
- Presentation edits preserve `If-Match` revision conflict behavior.
- Live clients apply an authoritative role-scoped snapshot before SSE and resume
  from `last_event_id`.
- A participant client must never retain manager roster, score-map or
  correctness data.
- PostgreSQL remains authoritative for answers, scores and replay events.
- User-authored content can be Persian, English or mixed; preserve direction
  boundaries.

## API/backend dependency rule

```text
HTTP adapter -> application/use case -> domain -> repository interface/adapter
```

Only the live module may advance live state or scores. Domain code does not
import HTTP/framework/Redis concerns.

## Frontend dependency rule

```text
app -> modules -> shared
```

- `shared` never imports from `modules` or `app`.
- Modules consume another module only through an intentional public API.
- Do not create new generic `components/utils/hooks/services` dumping grounds.
- New or substantially changed frontend boundaries are TypeScript.
- REST server state may use one TanStack Query client after the shared API/error
  boundary is ready; SSE state stays outside it.
- Keep native elements for simple controls and accessible headless primitives
  for complex focus/keyboard interactions.

## Change workflow

1. Inspect the relevant code and current status. Preserve unrelated work.
2. External REST/SSE changes: update OpenAPI first, then implementation and
   contract/behavior tests.
3. Persistent schema changes are forward-only migrations. Never edit an applied
   migration.
4. New configuration must update examples and `docs/configuration.md`.
5. Add tests at the smallest useful layer; run the applicable verification.
6. Update documentation only when its authoritative content actually changed.
7. State what was verified and what was not. Do not promote local evidence into
   production claims.

## Safety rails

Never without explicit owner approval:

- reset or delete databases/volumes;
- purge Redis to "fix" application state;
- edit applied migrations;
- force-push or rewrite shared branch history;
- expose secrets in logs, documentation, screenshots or `docker compose config`
  output;
- log passwords, cookies, participant credentials, or answers before closure.

## Verification

Typical frontend:

```sh
cd apps/web
npm ci
npm run api:types:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Typical backend:

```sh
cd apps/api
go fmt ./...
go test ./...
go vet ./...
```

Use `docs/local-development.md` for environment-specific commands.
Capacity work additionally follows `docs/capacity-plan.md` and
`load/k6/README.md`.

A passing `tsc` currently proves only TS/TSX coverage, not all remaining JSX.
A passing local load run proves only the recorded topology.

## Documentation

Use `docs/README.md` to find the authority for each question.
`docs/status/current.md` is the only mutable project-status source. Do not
create a second AI-only status or duplicate long change logs in this file.
