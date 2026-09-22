# Current project status

Last reviewed: 2026-09-22

This is the single current-state document for ProSlides. Architecture documents
describe durable rules, ADRs explain decisions, evidence documents record dated
measurements, and Git records history. Do not copy a full current-state section
into other documents.

## Product and architecture

ProSlides is an interactive presentation platform with a React/Vite frontend and
a Go modular-monolith backend.

- Browser commands and queries use HTTP.
- Live server-to-client delivery uses SSE.
- PostgreSQL is the durable source of truth.
- Redis is used for readiness/rate limits and may accelerate ephemeral live work,
  but it is not a durable ledger.
- The frontend target is a modular TypeScript SPA with dependency flow
  `app -> modules -> shared`.
- Production capacity must be demonstrated by the staged workload in
  `../capacity-plan.md`; local evidence is not a production claim.

## Current implementation

### Backend

The active product flows are implemented on the Go API: cookie/session identity,
presentation/editor CRUD, revisions and edit conflicts, access codes, live
sessions, idempotent commands/answers, role-scoped snapshots, durable SSE replay,
participant rejoin, scoring, roster pagination, and reports.

Known production-readiness work remains: provider secret provisioning,
production-like TLS load evidence, retention policy, backup/restore evidence,
rollout/drain verification, sampled cross-component traces, and staged 5k/10k
capacity proof.

### Frontend

The frontend is functional and regression-gated for its verified flows, but it
is not yet a fully modular TypeScript application.

Strengths already in place:

- React 19/Vite SPA with route-level lazy loading;
- OpenAPI-generated presentation transport types with drift checking;
- a shared typed JSON/API-error boundary and one TanStack Query REST cache;
- explicit presentation editor domain mapping and revision conflict recovery;
- semantic CSS tokens on migrated surfaces;
- Persian/RTL participant experience and mixed-content direction handling;
- bundle budgets, axe checks, CI-gated Playwright flows, and protocol/unit coverage;
- snapshot/SSE recovery and stable live request IDs.

Remaining frontend debt is tracked in `../frontend-status.md`. The largest
architectural gaps are incomplete TypeScript coverage, legacy top-level
`pages/components/services/utils/routes` ownership, an oversized React live runtime, incomplete design-system convergence, thin component/API-state
coverage; the CI browser gate includes a real manager/participant live lifecycle.

## Active priorities

These are independent tracks. A change in one track does not waive another.

1. **Production capacity:** repeat the 1k HTTP/SSE protocol twice on a named
   production-like single-API topology through TLS with cold readiness and
   continuous pool/query/lock/CPU/heap evidence.
2. **Frontend foundation:** continue the shared error/form/design-system
   foundation through the remaining identity/editor surfaces without adding
   parallel HTTP or state abstractions.
3. **Frontend modularization:** continue TypeScript/module migration through
   the remaining identity UI composition and live runtime, while preserving editor/live
   correctness. Reports and the manager presentation list now use the shared Query cache, and live transport/protocol/React ownership is under `modules/live`.
4. **Quality:** continue replacing source-regex checks with structural tooling
   and add component/API-state tests around migrated identity, report, editor and
   live recovery states.

## Documentation rules

- Current state belongs here.
- Durable architecture belongs in `../architecture.md` and
  `../frontend-architecture.md`.
- UX rules belong in `../frontend-professionalization.md`.
- Frontend debt/claim boundaries belong in `../frontend-status.md`.
- Measured historical evidence stays in its dated evidence document.
- Decisions belong in `../decisions/`.
- Do not maintain a second AI-only copy of repository state.

## Verification baseline

For ordinary material changes, run the applicable subset of:

```sh
# API
cd apps/api
go fmt ./...
go test ./...
go vet ./...

# Web
cd apps/web
npm ci
npm run api:types:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

The Playwright suite requires a reachable Go API. Capacity changes additionally
follow `../capacity-plan.md` and the k6/reconciliation procedure.

## Evidence freshness

Dated evidence remains valid only for the commit/topology it records. It must
not be silently promoted to evidence for the current tree, production field
performance, or a larger capacity level.
