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
| P0 | API error payloads are too weakly standardized; some frontend code infers semantics from optional fields/human text. | Define a stable machine-readable OpenAPI error shape with code, optional field errors, retry metadata and request/debug correlation; map it once at the shared API boundary. |
| P1 | TypeScript coverage is partial; active JSX is outside `tsc`. | Migrate feature/domain boundaries deliberately, not by mechanical extension renames. |
| P1 | Legacy top-level `pages/components/contexts/hooks/services/utils/routes/live` ownership still coexists with `app/modules/shared`. | Move active areas by vertical slice and enforce `app -> modules -> shared` with dependency tooling. |
| P1 | Live protocol/reconnect/roster state remains heavily embedded in React context. | Extract a typed `modules/live/api + runtime + react` boundary, then retire duplicate projections/compatibility state. |
| P1 | Design-system token vocabulary is not fully converged; old shadcn-style primitives use token names that are not the same semantic system as migrated product tokens. | Choose one semantic vocabulary, migrate primitives, and use accessible headless dialog/menu/popover primitives. |
| P1 | Critical Playwright flows exist but the default web CI job does not run `npm run test:e2e`. | Add deterministic browser CI with a real API stack, especially a seeded manager/participant lifecycle. |

## P2 product/maintainability debt

| Priority | Weakness / risk | Required remedy |
|---:|---|---|
| P2 | Identity/password forms contain extensive manual field state, validation, server-error mapping and submit lifecycle code. | Introduce RHF + Zod for ordinary forms after the API error contract is stable; keep design primitives independent of RHF. |
| P2 | Dashboard/report REST server state is manually fetched/cached in components. | Introduce one TanStack Query client through migrated identity/report slices using the existing typed fetch boundary and query cancellation signals. |
| P2 | Editor inspectors contain large custom draft/dirty/validation logic. | Keep editor state domain-driven; split inspector responsibilities and use form tooling only for suitable subforms. |
| P2 | Styling debt remains on legacy routes: direct colors, inline objects and physical direction utilities. | Migrate route-by-route to semantic tokens/logical properties and record browser comparisons. |
| P2 | Component/API-state coverage is thinner than protocol coverage. | Add Vitest + Testing Library + MSW for pending/success/validation/conflict/cancellation/reconnect states. |
| P2 | Architecture enforcement still relies partly on structural/source-regex tests. | Replace with dependency-boundary linting and dead-code/dependency checks where practical. |
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
