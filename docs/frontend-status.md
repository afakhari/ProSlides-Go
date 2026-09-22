# Frontend status and remaining debt

Last reviewed: 2026-09-22.

This file tracks frontend debt and the boundary of claims. Project-wide current
status and priorities live in `status/current.md`.

## Current strengths

| Area | Evidence/implementation |
|---|---|
| Product flow | Identity, dashboard, editor, reports and live flows use the Go HTTP/SSE boundary. |
| Live correctness | Snapshot recovery, stable request IDs, event/state ordering and participant non-disclosure have protocol/unit coverage. |
| Presentation contract | Generated OpenAPI transport types and editor domain adapters exist; revision conflicts are recoverable. |
| Persian UX | Participant live surfaces are Persian/RTL and consume display-safe presentation theming; editor/client copy has continued moving to Persian. |
| Accessibility | Critical stable routes have axe/browser checks, focus/reduced-motion/overflow assertions. |
| Performance | Build budgets enforce initial JS/CSS, largest route/file and zero initial preloads. |
| Routing/bundle | Heavy route code is lazy-loaded instead of preloaded into the entry route. |

## P0/P1 architecture debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P1 | The API error contract now formally supports machine code, field errors, retry metadata and request correlation, but most backend handlers still emit only the existing `error` code and legacy identity UI still has bespoke mapping. | Populate richer metadata where useful and migrate remaining consumers to the shared typed `ApiError` boundary without parsing human text. |
| P1 | TypeScript coverage is partial; active JSX is outside `tsc`. | Migrate feature/domain boundaries deliberately, not by mechanical extension renames. |
| P1 | Legacy top-level `pages/components/contexts/hooks/services/utils/routes/live` ownership still coexists with `app/modules/shared`. | Move active areas by vertical slice and enforce `app -> modules -> shared` with dependency tooling. |
| P1 | Live protocol/reconnect/roster state remains heavily embedded in React context. | Extract a typed `modules/live/api + runtime + react` boundary, then retire duplicate projections/compatibility state. |
| P2 | Core Button/ConfirmDialog primitives now use the ProSlides semantic token vocabulary and Radix AlertDialog, but legacy routes still contain direct colors and ad-hoc controls. | Continue route-by-route token migration, move remaining reusable controls into shared primitives/patterns, and add headless primitives only where keyboard/focus behavior warrants them. |
| P2 | Playwright now runs in CI against a real API/PostgreSQL/Redis stack, but the suite still lacks one deterministic end-to-end manager + participant live lifecycle in the same browser gate. | Extend the browser gate with a seeded manager/participant lifecycle covering join, answer, close, leaderboard, reconnect and end-state recovery. |

## P2 product/maintainability debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P2 | RHF + Zod form infrastructure is established and reset-password has migrated, but the large auth/register/verification screen still owns extensive manual field state and error mapping. | Migrate identity forms incrementally into `modules/identity`; keep UI primitives independent of RHF and preserve Google/OTP behavior with browser tests. |
| P2 | One TanStack Query client is established and reports use typed queries/infinite queries with cancellation and cursor pagination; dashboard and most identity REST state still use manual effects/state. | Extend the same query client incrementally to dashboard/identity REST reads while keeping editor draft state and live SSE outside the cache. |
| P2 | Editor inspectors contain large custom draft/dirty/validation logic. | Keep editor state domain-driven; split inspector responsibilities and use form tooling only for suitable subforms. |
| P2 | Styling debt remains on legacy routes: direct colors, inline objects and physical direction utilities. | Migrate route-by-route to semantic tokens/logical properties and record browser comparisons. |
| P2 | Component/API-state coverage is thinner than protocol coverage. | Add Vitest + Testing Library + MSW for pending/success/validation/conflict/cancellation/reconnect states. |
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
