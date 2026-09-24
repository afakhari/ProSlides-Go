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

The production frontend source is now fully TypeScript/TSX. Modularization and
verification hardening are still in progress, so TypeScript completion should
not be confused with completion of the broader frontend professionalization
program.

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

- enforce cross-module public boundaries and introduce dead-code/dependency
  analysis now that production source is TypeScript/TSX and legacy top-level
  route/UI roots are gone;
- continue semantic design-system/RTL convergence on mature surfaces as part of
  bounded product changes;
- add focused component/API-state tests between domain unit tests and browser
  end-to-end coverage;
- upgrade major framework/toolchain versions only in isolated compatibility
  changes after their runtime requirements are satisfied.

## Active priorities

1. Keep frontend/backend contracts and verified editor/live correctness stable.
2. Continue frontend modularization through small vertical slices, starting at
   high-leverage application and domain boundaries rather than cosmetic leaves.
3. Remove duplicate ownership and compatibility adapters as soon as the
   migrated boundary has equivalent verification.
4. Increase component/API-state verification before broad UI restructuring.
5. Keep performance, accessibility, Persian/RTL and cancellation behavior as
   completion criteria for each slice.

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
npm run test:e2e
```
