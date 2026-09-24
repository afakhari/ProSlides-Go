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
| REST state | One TanStack Query client exists; reports, presentation dashboard and protected identity session state use typed query boundaries where migrated. |
| Editor ownership | Question, content, design and audio use typed draft ownership with explicit dirty/save/discard/conflict behavior. |
| Live correctness | Snapshot/cursor/reconnect/roster ownership lives under `modules/live` and remains separate from ordinary REST caching and React rendering concerns. |
| Presentation contract | Generated API types and typed domain boundaries exist where migrated; presentation edits preserve revision conflict semantics. |
| Accessibility | Stable routes have axe/interaction checks and the migrated editor slices use accessible feedback/dialog primitives. |
| Verification | Browser acceptance includes auth/dashboard/report, manager/player live reconnect, and the principal editor draft/conflict flows. |
| Performance | Build budgets and route-level lazy loading guard against unnecessary frontend growth. |

## Architecture debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P1 | TypeScript migration is incomplete; active JSX/JS remains in marketing, live UI/adapters, dashboard and compatibility utilities. | Continue migration by feature/domain boundary, never by extension-only renames. |
| P1 | Legacy top-level ownership (`pages/components/utils/routes/contexts`) still coexists with `app/modules/shared`. | Move ownership into the appropriate domain and delete compatibility shims once callers migrate. |
| P1 | The shared HTTP boundary still depends on legacy `utils/apiFetch`, and some dashboard identity actions still bypass the typed identity API. | Finish API-boundary inversion so `shared/api` owns transport and modules consume typed APIs rather than legacy utilities. |
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

After the data-router/session slice, the highest-value boundaries are:

1. finish the ordinary HTTP/identity boundary and remove legacy API utilities;
2. migrate live React adapters and `PresentationEntry` to TypeScript/module
   ownership without changing live protocol semantics;
3. move landing/team ownership into the marketing module while converging RTL
   and semantic styling;
4. remove emptied legacy roots and add stronger dependency/dead-code tooling.

## Claim boundary

The frontend should not be described as fully modular, fully TypeScript, or
complete until the remaining active legacy ownership and verification gaps are
closed.

Historical measurements remain tied to the commit and environment where they
were recorded and are not current production evidence.
