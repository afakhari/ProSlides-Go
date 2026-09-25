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
| Live correctness | Snapshot/cursor/reconnect/roster ownership lives under `modules/live`; the protocol planner/projection/cursor boundary is typed, React adapters and role composition are typed, manager and participant presentation UIs are module-owned TypeScript, participant join/recovery/answer state and manager synchronization have dedicated typed controllers, and `useSyncExternalStore` exposes runtime state without duplicating lifecycle ownership. |
| Presentation contract | Generated API types and typed domain boundaries exist where migrated; presentation edits preserve revision conflict semantics. |
| Accessibility | Stable routes have axe/interaction checks and the migrated editor slices use accessible feedback/dialog primitives. |
| Verification | Browser acceptance includes auth/dashboard/report, manager/player live reconnect, and the principal editor draft/conflict flows. |
| Performance | Build budgets and route-level lazy loading guard against unnecessary frontend growth. |

## Architecture debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P1 | Production frontend source is TypeScript/TSX and top-level compatibility leaves are gone. Cross-module imports, runtime cycles and unreachable source files are now CI-enforced, but unused-export analysis is still incomplete. | Add conservative dead-export analysis only after the file-level architecture gate has proved stable; avoid heuristic checks that create false positives. |
| P2 | Dashboard ownership is typed and semantic-token adoption is improved, but some mature product surfaces still contain older utility-color styling that should converge opportunistically. | Continue semantic styling and logical-direction cleanup only with bounded feature work; avoid a broad cosmetic rewrite. |
| P2 | A Vite-native Testing Library/MSW component-test layer now covers dashboard pending, list error/retry, client filtering and create recovery/navigation states, but editor/report/live API-state coverage is still thinner than domain and browser coverage. | Extend the same network-level component-test harness to high-risk editor/report/live pending, validation, cancellation and recovery paths without duplicating E2E scenarios. |
| P2 | Architecture CI now enforces `shared -> modules/app`, `modules -> app`, public-only cross-module access, runtime acyclicity and source reachability. Export-level dead-code detection remains intentionally separate. | Add export-level analysis with an explicit false-positive policy and exemptions for framework/public entry points. |
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

1. extend component/API-state coverage from dashboard to high-risk editor,
   report and live boundaries;
2. add conservative export-level dead-code analysis with explicit exemptions;
3. continue semantic styling/accessibility convergence only where it improves a
   concrete product flow;
4. keep framework/toolchain upgrades isolated behind full CI/E2E compatibility
   verification.

## Claim boundary

The production frontend source can now be described as TypeScript/TSX. The frontend should not yet be described as fully complete until export-level dead-code analysis and verification gaps are closed.

Historical measurements remain tied to the commit and environment where they
were recorded and are not current production evidence.
