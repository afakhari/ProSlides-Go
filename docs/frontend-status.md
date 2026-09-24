# Frontend status and remaining debt

Last reviewed: 2026-09-24.

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
| Live correctness | Snapshot/cursor/reconnect/roster ownership lives under `modules/live`; React adapters and the route entry are typed, player recovery and manager presentation synchronization have dedicated typed controllers, and `useSyncExternalStore` exposes runtime state without duplicating lifecycle ownership. |
| Presentation contract | Generated API types and typed domain boundaries exist where migrated; presentation edits preserve revision conflict semantics. |
| Accessibility | Stable routes have axe/interaction checks and the migrated editor slices use accessible feedback/dialog primitives. |
| Verification | Browser acceptance includes auth/dashboard/report, manager/player live reconnect, and the principal editor draft/conflict flows. |
| Performance | Build budgets and route-level lazy loading guard against unnecessary frontend growth. |

## Architecture debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P1 | TypeScript migration is incomplete; active JSX/JS remains in marketing, the live presentation orchestration/UI leaves, dashboard and compatibility utilities. | Continue migration by feature/domain boundary, never by extension-only renames. |
| P1 | Legacy top-level ownership (`pages/components/utils/routes/contexts`) still coexists with `app/modules/shared`. | Move ownership into the appropriate domain and delete compatibility shims once callers migrate. |
| P2 | Design-system and logical-direction adoption is incomplete on legacy marketing/live surfaces. | Replace physical direction and direct visual values as those routes migrate. |
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

After the HTTP-boundary inversion, the highest-value boundaries are:

1. reduce the remaining `PresentationFlow.jsx` shell to typed role
   composition/error recovery and remove the last JSX orchestration boundary;
2. migrate manager/player live UI leaves from legacy `pages` ownership as
   their contracts become typed;
3. move landing/team ownership into the marketing module while converging RTL
   and semantic styling;
4. remove emptied legacy roots and add stronger dependency/dead-code tooling.

## Claim boundary

The frontend should not be described as fully modular, fully TypeScript, or
complete until the remaining active legacy ownership and verification gaps are
closed.

Historical measurements remain tied to the commit and environment where they
were recorded and are not current production evidence.
