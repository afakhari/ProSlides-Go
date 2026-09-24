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
| P1 | React route/UI source no longer has active JSX leaves; the remaining production JavaScript boundary is the live runtime protocol compatibility module. | Migrate the live protocol only as an isolated correctness change with cursor/order/reconnect tests; do not combine it with UI work. |
| P1 | The former top-level `pages/components/utils` compatibility leaves have been removed, but dependency enforcement and dead-export analysis are still incomplete. | Enforce public module boundaries and add dead-code/dependency tooling before declaring modularization complete. |
| P2 | Dashboard ownership is typed and semantic-token adoption is improved, but some mature product surfaces still contain older utility-color styling that should converge opportunistically. | Continue semantic styling and logical-direction cleanup only with bounded feature work; avoid a broad cosmetic rewrite. |
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

1. migrate `modules/live/runtime/protocol.js` to a typed protocol boundary in
   an isolated live-correctness slice with protocol regression coverage;
2. add stronger cross-module dependency/dead-code tooling now that top-level
   compatibility roots are gone;
3. add focused component/API-state coverage for dashboard and other migrated
   boundaries;
4. continue semantic styling/accessibility convergence only where it improves a
   concrete product flow.

## Claim boundary

The frontend should not be described as fully modular, fully TypeScript, or
complete until the remaining active legacy ownership and verification gaps are
closed.

Historical measurements remain tied to the commit and environment where they
were recorded and are not current production evidence.
