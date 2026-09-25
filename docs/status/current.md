# Current project status

Last reviewed: 2026-09-25

This is the single current-state document for ProSlides. Architecture documents
define durable rules, ADRs explain decisions, evidence documents record dated
measurements, and Git records history.

## Baseline

Commit `960dbce` is the historical rollback anchor from 2026-09-23, not the
current mainline SHA. Work after that anchor is part of the active product only
when it has been reintroduced through reviewed changes and merged to `main`.
Git remains authoritative for the exact current commit.

## Product and architecture

ProSlides is an interactive presentation platform with a React/Vite frontend and
a Go modular-monolith backend.

- Browser commands and queries use HTTP.
- Live delivery uses SSE.
- PostgreSQL is the durable source of truth.
- Redis is used for operational and ephemeral workloads, not as the durable
  product ledger.
- Frontend architecture is converging on a modular TypeScript application with:

```text
app -> modules -> shared
```

## Frontend current state

The shipping application frontend source is fully TypeScript/TSX. The project
is still pre-production and broad frontend redesign is expected, so the current
development policy intentionally optimizes for fast iteration with cheap
structural/correctness guardrails. Production-level verification is a separate
hardening milestone, not a requirement for every visual iteration.

Current strengths:

- React/Vite with checked lazy route splitting and bundle budgets.
- React Router data routing owns the application route tree, protected-manager
  session loading, route pending state and route error boundaries.
- The protected-session query shares the same TanStack Query client and typed
  identity API boundary used by the application instead of maintaining a
  parallel component-local fetch lifecycle.
- Ordinary REST transport is owned by `shared/api/http.ts`, including API base
  URL construction, credentials, CSRF, JSON parsing, typed API errors,
  cancellation propagation and auth-expiry notification.
- Generated OpenAPI transport types and typed module/domain boundaries are used
  where migrated.
- Question, content, design and audio editor slices use explicit typed draft
  ownership and preserve local work across edit conflicts.
- Live snapshot/cursor/reconnect/roster ownership is separated from React
  rendering and ordinary REST caching; typed React providers/hooks expose the
  runtime through `useSyncExternalStore`. The live route entry and role
  composition are owned by typed `modules/live/routes` boundaries. Manager
  presentation UI, presenter controls, local QR generation, lobby, question,
  leaderboard, content and final-result surfaces are now owned by typed
  `modules/live/manager/ui` code rather than legacy top-level pages/components.
  Participant join, waiting, question, leaderboard, content and final-result
  surfaces are now module-owned TypeScript. Participant recovery, join retry and
  answer-attempt ownership are separated into typed controllers; answer
  selection is index based, answer POSTs remain independent from SSE delivery
  health, retries reuse one request ID without a persistent mutation queue, and
  participant profiles are scoped per room. Manager
  question/content/leaderboard reconciliation and presenter navigation remain
  isolated in a typed manager controller. Presentation loading is cancellable
  and uses the shared ordinary REST boundary; the dedicated live transport
  remains focused on session commands, snapshots, roster and SSE.
- Marketing landing/team routes are now module-owned TypeScript, use semantic
  styling and explicit RTL/LTR boundaries, preserve the documented historical
  Rust/Django contributions while identifying Go as the current backend, and
  avoid unsupported quantitative product claims.
- The manager dashboard is now a typed presentation-module route. Search/header
  composition is isolated from presentation mutations, account/logout/password
  setup behavior is owned by the Identity public boundary, and dashboard launch
  errors use accessible notice feedback instead of the legacy hand-built modal.
- Production source under `apps/web/src` has no remaining JavaScript or JSX
  files. The live protocol planner/cursor/projection boundary is now typed and
  the former handwritten `protocol.d.ts` compatibility declaration has been
  removed. The former top-level `pages`, `components` and `utils`
  compatibility leaves used by these flows are also gone.
- Browser acceptance covers core marketing/auth/dashboard/report flows,
  manager/player live lifecycle with reconnect, and the principal editor
  draft/conflict flows.

Remaining work:

- continue rapid redesign of frontend surfaces while preserving typed contracts,
  editor revision/conflict semantics, live protocol rules and the enforced
  module dependency graph;
- use the existing Vitest/Testing Library/MSW harness selectively for risky
  behavior touched by each redesign slice rather than expanding coverage for its
  own sake;
- converge semantic design-system, Persian/RTL and accessibility behavior as
  redesigned surfaces stabilize;
- defer broad E2E expansion, visual regression, export-level dead-code analysis,
  exhaustive responsive/accessibility matrices and other production-readiness
  hardening until they provide more signal than maintenance cost;
- upgrade major framework/toolchain versions only in isolated compatibility
  changes after their runtime requirements are satisfied.

## Active priorities

1. Maximize pre-production frontend redesign velocity; avoid polishing or
   exhaustively testing UI that is expected to change again soon.
2. Keep frontend/backend contracts, editor revision/conflict semantics, live
   protocol correctness and authentication boundaries stable.
3. Preserve the enforced module graph and TypeScript/API checks because they are
   cheap guardrails with high regression value.
4. Add tests alongside a redesign only when they protect costly behavioral
   invariants, regressions already observed, or non-obvious recovery/cancellation
   semantics.
5. Move broad browser matrices, visual regression, exhaustive accessibility
   review, export-level dead-code analysis and release hardening into an explicit
   pre-production readiness phase.
6. Keep Persian/RTL and accessibility semantics in the implementation direction,
   but do not block rapid visual iteration on exhaustive audits of temporary UI.

## Documentation rules

- Current state belongs here.
- Architecture rules belong in architecture documents.
- Frontend debt belongs in `frontend-status.md`.
- Historical evidence must remain tied to its original commit and environment.

## Verification policy

### Fast inner loop

During active redesign, prefer the smallest relevant set locally. For ordinary
frontend work this normally means:

```sh
cd apps/web
npm run lint
npm run typecheck
npm run architecture:check
npm run test:unit
npm run test:component
```

Run `api:types:check` when API/generated types may be affected and `build`
when route splitting, dependencies, styling compilation or bundle shape changes.

### Pull-request safety net

The required `web` and `api` CI checks remain the normal merge guardrails.
The existing component suite is intentionally small and fast. Add tests only
when the changed slice needs them.

`containers`/browser E2E and CodeQL continue to provide integration/security
signal but are intentionally not required merge checks during the current
single-developer pre-production phase. A failure that plausibly comes from the
changed integration boundary should still be investigated rather than ignored.

### Production-readiness hardening

Before the first production release, run and stabilize the full verification
set, including:

```sh
cd apps/web
npm ci
npm run api:types:check
npm run lint
npm run typecheck
npm run architecture:check
npm run test:unit
npm run test:component:typecheck
npm run test:component
npm run build
npm run test:e2e
```

That hardening milestone also includes full responsive/accessibility review,
critical error/conflict/cancellation recovery, container/deployment validation,
security scanning and deferred dead-code/dependency analysis.
