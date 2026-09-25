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
| P3 | Application frontend source is TypeScript/TSX and top-level compatibility leaves are gone. Cross-module imports, runtime cycles and unreachable source files are CI-enforced; unused-export analysis is intentionally deferred while broad redesign is active. | Run conservative dead-export/dependency analysis in the pre-production hardening phase with explicit exemptions; do not interrupt rapid redesign for speculative cleanup. |
| P2 | Dashboard ownership is typed and semantic-token adoption is improved, but some mature product surfaces still contain older utility-color styling that should converge opportunistically. | Continue semantic styling and logical-direction cleanup only with bounded feature work; avoid a broad cosmetic rewrite. |
| P2 | A fast Vitest/Testing Library/MSW layer covers representative dashboard API states, while editor/report/live component coverage remains intentionally selective during pre-production redesign. | Add tests only when a redesign slice touches costly behavioral invariants; defer broad state-matrix coverage to the production-readiness hardening phase. |
| P2 | Architecture CI enforces `shared -> modules/app`, `modules -> app`, public-only cross-module access, runtime acyclicity and source reachability. | Keep this cheap structural gate active during rapid redesign; it prevents architectural backsliding without coupling tests to unstable UI. |
| P3 | Major framework versions should be kept current, but upgrades can carry runtime compatibility requirements. | Upgrade React/React Router/toolchain in isolated changes with full CI/E2E rather than coupling upgrades to architectural migrations. |

## Pre-production development mode

The project is not yet production and frontend redesign speed is currently a
first-order constraint. The preferred strategy is **fast inner-loop guardrails
plus a deliberate production-readiness hardening phase**, not production-level
verification after every visual iteration.

Keep continuously:

- TypeScript, lint and generated API contract checks;
- module/dependency boundary enforcement;
- stable domain/protocol tests;
- the small existing component/API-state safety net;
- targeted tests for high-risk behavior touched by the current slice.

Defer until a surface stabilizes or the production-readiness phase:

- broad component state matrices for UI that is about to be redesigned;
- visual regression snapshots;
- exhaustive viewport/device matrices;
- full manual accessibility audits;
- export-level dead-code cleanup with meaningful false-positive risk;
- broad E2E expansion beyond critical flows.

A deferred check is not considered unnecessary; it has simply been moved to the
point where its maintenance cost is lower and its signal is more valuable.

## Editor status

The editor's domain ownership no longer needs another broad architectural
restructuring pass. Its visual composition may be redesigned aggressively while
preserving:

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

1. execute planned frontend redesigns quickly while preserving API/domain/live
   invariants and the enforced module graph;
2. add targeted component/API-state tests only for high-risk behavior touched by
   each redesign slice;
3. converge semantic styling, Persian/RTL and accessibility as redesigned
   surfaces stabilize instead of polishing soon-to-be-replaced UI;
4. schedule broad state-matrix coverage, export-level dead-code analysis,
   visual regression and full accessibility/responsive verification for the
   pre-production hardening phase;
5. keep framework/toolchain upgrades isolated from large UI redesigns.

## Claim boundary

The shipping application frontend source can now be described as TypeScript/TSX.
The project is explicitly pre-production: current verification is optimized for
safe rapid iteration, and production readiness still requires the deferred
hardening work described above.

Historical measurements remain tied to the commit and environment where they
were recorded and are not current production evidence.
