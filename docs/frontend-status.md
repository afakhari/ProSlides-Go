# Frontend status and remaining debt

Last reviewed: 2026-09-25.

This file tracks frontend debt and claim boundaries. Project-wide current state
and priorities live in `status/current.md`.

## Historical rollback anchor

`960dbce` is the 2026-09-23 rollback anchor. It is retained only to explain
history; reviewed work merged after that commit is active mainline work.

## Current strengths

| Area | Evidence/implementation |
|---|---|
| Application routing | A typed React Router data route tree owns nested manager routing, route errors, lazy route modules and protected-session loading. |
| REST transport/state | `shared/api/http.ts` exclusively owns ordinary REST base URL, credentials, CSRF, JSON/error handling and cancellation; live presentation reads also use this boundary instead of the SSE/session transport, and one TanStack Query client owns ordinary REST cache state where migrated. |
| Editor ownership | Question, content, design and audio use typed draft ownership with explicit dirty/save/discard/conflict behavior. |
| Live correctness | Snapshot/cursor/reconnect/roster ownership lives under `modules/live`; React adapters and role composition are typed, manager and participant presentation UIs are module-owned TypeScript, participant join/recovery/answer state and manager synchronization have dedicated typed controllers, and `useSyncExternalStore` exposes runtime state without duplicating lifecycle ownership. |
| Presentation contract | Generated API types and typed domain boundaries exist where migrated; presentation edits preserve revision conflict semantics. |
| Accessibility | Stable routes have axe/interaction checks and the migrated editor slices use accessible feedback/dialog primitives. |
| Verification | Browser acceptance includes auth/dashboard/report, manager/player live reconnect, and the principal editor draft/conflict flows. |
| Performance | Build budgets and route-level lazy loading guard against unnecessary frontend growth. |

## Architecture debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P1 | TypeScript migration is incomplete; active JSX/JS remains in the presentation dashboard and compatibility utilities outside migrated live/marketing routes. | Continue migration by feature/domain boundary, never by extension-only renames. |
| P1 | Legacy top-level ownership (`pages/components/utils/routes` and compatibility leaves) still coexists with `app/modules/shared`. | Move ownership into the appropriate domain and delete compatibility shims once callers migrate. |
| P2 | Design-system and logical-direction adoption is incomplete on remaining legacy dashboard/compatibility surfaces. | Replace physical direction and direct visual values as those routes migrate. |
| P2 | Component/API-state testing is thinner than domain and browser integration coverage. | Add Vite-native component tests with Testing Library/MSW for pending, validation, error, cancellation and recovery paths. |
| P2 | Dependency enforcement covers `shared -> modules/app` and `modules -> app`, but cross-module public API rules and dead-code detection are not yet complete. | Strengthen lint/dependency checks and introduce dead-export/dependency analysis after compatibility shims shrink. |
| P3 | Major framework versions should be kept current, but upgrades can carry runtime compatibility requirements. | Upgrade React/React Router/toolchain in isolated changes with full CI/E2E rather than coupling upgrades to architectural migrations. |

## Editor status

The editor no longer needs another broad restructuring pass. Its remaining work
is consistency, cleanup, accessibility and targeted coverage while preserving:

- domain-owned drafts and baselines;
- local work across revision conflicts;
- separation of authoring, preview and live runtime state;
- one presentation revision contract across mutations.

## Next migration focus

Both live roles now own typed module-local presentation UI. Participant join,
waiting, question, leaderboard, content and final-result surfaces are
module-owned; answer selection uses stable option indexes, answer HTTP commands
remain independent from SSE delivery health, retries reuse one request ID in
memory, legacy persistent answer queues are retired, and participant profiles
are scoped per room. The highest-value remaining boundaries are:

1. migrate the presentation dashboard and remaining active JSX utilities by
   domain boundary;
2. remove emptied legacy roots and compatibility utilities;
3. add stronger dependency/dead-code tooling and focused component/API-state
   coverage around migrated boundaries;
4. keep marketing copy, SEO and historical team information aligned with
   verified product capabilities and repository history.

## Claim boundary

The frontend should not be described as fully modular, fully TypeScript, or
complete until the remaining active legacy ownership and verification gaps are
closed.

Historical measurements remain tied to the commit and environment where they
were recorded and are not current production evidence.
