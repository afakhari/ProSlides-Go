# Current project status

Last reviewed: 2026-09-24

This is the single current-state document for ProSlides. Architecture documents
define durable rules, ADRs explain decisions, evidence documents record dated
measurements, and Git records history.

## Baseline

The current mainline frontend baseline after rollback is:

```
960dbce
```

Changes removed from main after this point are historical changes and require a
new reviewed migration before becoming part of the active state.

## Product and architecture

ProSlides is an interactive presentation platform with a React/Vite frontend and
a Go modular-monolith backend.

- Browser commands and queries use HTTP.
- Live delivery uses SSE.
- PostgreSQL is the durable source of truth.
- Redis is used for operational and ephemeral workloads, not as the durable
  product ledger.
- Frontend architecture targets a modular TypeScript application with:

```
app -> modules -> shared
```

## Frontend current state

The frontend is functional but is not yet a fully modular TypeScript
application.

Current strengths:

- React/Vite application structure with lazy loading.
- Typed API boundaries where migrated.
- Explicit editor domain ownership direction.
- Live runtime separation from React rendering concerns.
- Accessibility, build and regression checks for verified flows.

Remaining work:

- complete TypeScript migration;
- remove remaining legacy ownership boundaries;
- continue design-system convergence;
- increase focused component/API-state coverage.

## Active priorities

1. Keep frontend and backend contracts stable.
2. Continue frontend modularization through small vertical slices.
3. Preserve editor draft ownership, conflict recovery and live separation.
4. Improve verification coverage before larger architectural changes.

## Documentation rules

- Current state belongs here.
- Architecture rules belong in architecture documents.
- Frontend debt belongs in `frontend-status.md`.
- Historical evidence must remain tied to its original commit and environment.

## Verification baseline

Applicable verification commands should be run before material changes:

```sh
cd apps/web
npm ci
npm run api:types:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
```
