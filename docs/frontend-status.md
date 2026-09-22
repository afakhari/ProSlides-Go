# Frontend status and remaining debt

Last reviewed: 2026-09-22.

This file tracks frontend debt and the boundary of claims. Project-wide current
status and priorities live in `status/current.md`.

## Current strengths

| Area | Evidence/implementation |
|---|---|
| Product flow | Identity, dashboard, editor, reports and live flows use the Go HTTP/SSE boundary. |
| Live correctness | A typed runtime controller owns snapshot/cursor/reconnect/roster/command state; React is a thin adapter, projections are single-sourced from snapshot + roster, and protocol/unit coverage guards ordering, retry and disclosure invariants. |
| Presentation contract | Generated OpenAPI transport types and editor domain adapters exist; revision conflicts are recoverable. |
| Persian UX | Participant live surfaces are Persian/RTL and consume display-safe presentation theming; editor/client copy has continued moving to Persian. |
| Accessibility | Critical stable routes have axe/browser checks, focus/reduced-motion/overflow assertions. |
| Performance | Build budgets enforce initial JS/CSS, largest route/file and zero initial preloads. |
| Routing/bundle | Heavy route code is lazy-loaded instead of preloaded into the entry route. |

## P0/P1 architecture debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P2 | The API error contract and identity UI now use stable machine codes through the shared typed `ApiError` boundary; most backend handlers still emit only the code and optional retry metadata. | Add structured field errors/correlation metadata only where they provide concrete UX or operational value; do not return to parsing human-readable server text. |
| P1 | TypeScript coverage is partial; active JSX is outside `tsc`. | Migrate feature/domain boundaries deliberately, not by mechanical extension renames. |
| P1 | Legacy top-level `pages/components/services/utils/routes` ownership still coexists with `app/modules/shared`; active live API/runtime/React ownership has moved into `modules/live`. | Continue moving active legacy areas by vertical slice and enforce `app -> modules -> shared` with dependency tooling. |
| P2 | Core Button/ConfirmDialog primitives now use the ProSlides semantic token vocabulary and Radix AlertDialog, but legacy routes still contain direct colors and ad-hoc controls. | Continue route-by-route token migration, move remaining reusable controls into shared primitives/patterns, and add headless primitives only where keyboard/focus behavior warrants them. |
| P2 | Playwright runs in CI against a real API/PostgreSQL/Redis stack and now covers a manager + participant lifecycle through join, answer, leaderboard, participant reconnect and manager end-state. | Extend the browser gate only when a material uncovered live behavior is identified; keep protocol/unit tests as the denser correctness layer. |

## P2 product/maintainability debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P2 | Identity transport/error handling, Zod schemas and RHF field ownership are module-owned. The auth route is now TSX orchestration over focused module UI plus dedicated Google Identity and persisted verification-timer hooks. | Add component/API-state coverage for identity pending/error/recovery states and continue TypeScript migration at the remaining presentation/editor boundaries; do not re-centralize auth state in the route. |
| P2 | One TanStack Query client owns reports and the manager presentation list with cancellation; remaining REST reads should migrate only where cache ownership is useful. | Continue incremental module-owned Query adoption while keeping editor draft state and live SSE outside the cache. |
| P2 | Question authoring now uses a typed domain draft/reducer, backend-aligned validation, explicit save/conflict recovery and focused inspector components. Other editor surfaces still contain large custom draft/dirty logic, and the canvas does not yet project unsaved question drafts. | Extend the same domain-owned pattern to content/design/audio where it reduces real complexity, then make the editor canvas consume the active typed draft without turning the editor into one giant form. |
| P2 | Styling debt remains on legacy routes: direct colors, inline objects and physical direction utilities. | Migrate route-by-route to semantic tokens/logical properties and record browser comparisons. |
| P2 | Browser coverage now includes question-authoring save/reorder/Persian-number/edit-conflict recovery on the real API stack, but focused component/API-state coverage is still thinner than protocol coverage. | Add Vitest + Testing Library + MSW for dense pending/success/validation/conflict/cancellation states where browser tests would be too slow or broad. |
| P2 | Core dependency direction `app -> modules -> shared` is now lint-enforced for shared/module imports, while some finer-grained cross-module and dead-code checks still rely on convention/structural tests. | Add finer public-module API rules and dead-code/dependency analysis once the remaining legacy ownership has moved. |
| P2 | Local Web Vitals are not production field performance. | Add privacy-safe RUM and release-tagged frontend error/performance observability before field-grade claims. |

## P3 tooling debt

- The project should move from the `rolldown-vite` preview alias to stable
  Vite 8 in a dedicated compatibility-tested upgrade.
- React/Tailwind/Router/TypeScript major/minor upgrades should be isolated from
  architecture migration so failures have one cause.
- Review development dependency advisories separately; do not use broad
  `npm audit fix` as architecture work.

## Claim boundary

The frontend should not be described as fully modular, fully TypeScript,
field-performance certified, or complete-live-browser certified until the
corresponding items above are closed.

The historical F0-F5 program established a useful baseline. Its dated evidence
is preserved separately and does not waive current debt.
