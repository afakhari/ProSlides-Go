# Persian-first frontend professionalization plan

## Purpose and product direction

This document owns the experience sequence and acceptance gates for turning the
current functional React client into a coherent, production-quality Persian
product. `docs/frontend-architecture.md` owns technical boundaries and ADR 0003
records the accepted architecture decision. If they disagree, reconcile them
before implementation.

The target product language is Persian. User-facing application chrome,
primary workflows, validation, empty states, loading states, and accessibility
labels must be Persian and use RTL layout. API fields, code identifiers, URLs,
logs, and developer documentation remain English.

Professional does not mean adding long or decorative animation. The product
must feel continuous, predictable, fast, accessible, and visually consistent.
Durable API behavior and the existing editor/live correctness boundaries must
not be weakened for visual polish.

## Audited baseline — 2026-08-28

A real-Chrome review at desktop and 390x844 reproduced the first critical flow:

```text
dashboard -> Creating button -> unrelated full-screen loader -> empty editor
```

The dashboard, loader, and editor currently change color system, density,
language, and spatial structure at once. The editor initially shows a mostly
blank canvas with weak first-action guidance. Responsive authentication works,
but the editor header is crowded and English labels wrap.

The pre-F1 source audit found 78 JS/TS/CSS files and about 18,300 nonblank
lines. After F1 and the first two F2 slices the tree contains 54 JSX, 15 JS, 9
TS, and 4 TSX files. `tsconfig.json` checks TS/TSX, but the passing typecheck still
excludes most JSX UI; ESLint checks JS/JSX but not TS/TSX. Four UI
files exceed 1,000 nonblank lines. `App.jsx` retains unreachable legacy runtime
after the active route table, production paths still import mock-era view
models, and the editor carries duplicate legacy/canonical fields.

The initial styles contained roughly 381 direct color expressions, 75 inline
style objects, and 169 physical-direction utilities. The first F2 slice now
provides one semantic theme and one Tailwind import for dashboard/editor/share;
unrelated routes retain direct/style-direction debt for their ordered phase.
Static legacy imports also
preload DnD and motion on the landing route (about 252 KiB gzip). Blindly
removing manual chunks produced a 736 KiB raw entry in an experiment, so dead
code removal and route isolation must precede chunk tuning.

The latest real-Chrome run against the current Vite source completed register,
dashboard creation, editor loading, access-code save, and share at 1440x900 and
390x844. Inspected screenshots showed no visual regression; mobile document
and client widths matched, title/code computed directions were RTL/LTR, and
the browser reported zero console errors.

## Experience rules for all frontend work

1. Persian is the default user-facing language and page direction is RTL.
2. Navigation preserves spatial context. Async route changes use a shell-shaped
   skeleton, not a visually unrelated full-screen loader.
3. Motion is functional, normally 160-220 ms, and disabled or reduced under
   `prefers-reduced-motion`.
4. Every mutation exposes pending, success, and recoverable error states. A
   disabled control must explain why.
5. Empty states identify the next useful action. They must not look like broken
   or unfinished screens.
6. One design-token system owns brand colors, typography, spacing, radii,
   shadows, focus states, and semantic feedback colors.
7. Responsive acceptance is required at desktop 1440x900 and mobile 390x844.
8. Keyboard navigation, visible focus, named icon buttons, live status regions,
   and reduced motion are part of completion, not a later cosmetic pass.
9. Mock/demo data must not enter production flows. Unimplemented controls are
   hidden or explicitly marked as unavailable.
10. Large UI changes require real-browser snapshots before and after the change.

## Ordered delivery phases

### Phase F0 — architecture and evidence baseline — complete

- Audited routes, source size, typing, lint, styling, dependencies, bundle, and
  the real-browser creation flow.
- Accepted ADR 0003 and created `docs/frontend-architecture.md`.
- Established one ordered F1-F5 track and corrected stale mock-data guidance.

F0 changed documentation only; it does not claim the runtime has been migrated.

### Phase F1 — creation-to-editor continuity — complete 2026-08-28

Objective: make `ارائه جدید` feel like one continuous Persian workflow while
establishing the first narrow `modules/presentations` and `shared/ui` seam.

- Keep visible progress in the dashboard while the create request commits.
- Issue exactly one request and one navigation with explicit creation context,
  then render an editor-shaped skeleton.
- Replace the generic loader on the editor route.
- Fade the loaded editor into the same shell without layout jump.
- Add a Persian first-run empty state with a clear first-slide action.
- Open slide-type selection after the first intentional draft action, not as an
  accidental route side effect.
- Localize every user-facing string introduced or touched by this flow.
- Respect reduced-motion preference.

Acceptance:

- A single click creates exactly one presentation and performs one navigation.
- Pending state is announced and duplicate clicks are blocked.
- No unrelated background/loading screen flashes between dashboard and editor.
- The final editor remains usable at 1440x900 and 390x844.
- Create failure leaves the user on the dashboard with a Persian recoverable
  error and no false success state.
- Unit, lint, typecheck, build, and real-Chrome flow checks pass.
- The browser trace or test proves the request and navigation counts.

### Phase F2 — Persian app shell and design system — in progress

Completed first foundation slice on 2026-08-28:

- `index.css` owns Tailwind plus brand, surface, content, semantic feedback,
  focus, typography, radius, shadow, and motion tokens.
- Typed `shared/ui/Notice.tsx` owns pending, success, warning, and error
  announcements with polite/assertive live-region behavior.
- Dashboard, editor, route skeleton, header, and share use the tokens and
  shared notice; native alerts and the duplicate Tailwind import are removed
  from that slice.
- Share copy is Persian, its dialog has an accessible name, user-authored
  titles use `dir="auto"`, and access codes/URLs use explicit LTR boundaries.
- Lint, TS/TSX typecheck, 37 unit tests, build, real-Chrome desktop/mobile
  screenshots, no-overflow measurement, and zero console errors passed.

Remaining ordered F2 work:

- Introduce the typed shared HTTP/API-error boundary for manager presentation
  reads/mutations as the exact next slice.
- Translate remaining editor/common-dialog copy after the catalog exists;
  report and live translation remain outside the current narrow slice.
- Finish keyboard focus containment/restoration for migrated dialogs and move
  remaining dashboard/editor physical-direction styles to logical properties.
- Continue hiding or explicitly marking non-functional editor controls.

Completed second foundation slice on 2026-08-28: dashboard/editor now share a
persistent authenticated manager shell with route-local pending UI and a
recoverable Persian error boundary. The typed Persian catalog is consumed by
dashboard/editor/share. Lint, expanded typecheck, 39 unit tests, build, and all
three system-Chrome E2E flows passed.

### Phase F3 — editor information architecture and responsive refinement

- Simplify editor navigation and clarify canvas/panel hierarchy.
- Make slide creation type-first and avoid abandoned draft slides.
- Refine mobile header, bottom toolbar, sheets, and safe-area behavior.
- Add consistent save state, dirty state, and conflict recovery affordances.

### Phase F4 — maintainability, accessibility, and product cleanup

- Split oversized route/components behind stable domain boundaries.
- Remove duplicated presentation runtime from `App.jsx`.
- Remove production mock-data dependencies.
- Complete keyboard, contrast, focus, screen-reader, and reduced-motion audit.
- Add screenshot/interaction regression coverage for critical Persian flows.

### Phase F5 — measured accessibility and performance hardening

- Complete keyboard, focus-order, contrast, screen-reader, reduced-motion, and
  RTL audits across critical flows.
- Measure route bundles and Core Web Vitals, then set CI budgets from an
  accepted baseline.
- Remove dead imports before tuning explicit chunk boundaries; lazy-load route
  code and heavy editors based on measurements.
- Record browser evidence and close remaining UX gaps before returning priority
  to production-readiness work.

## Priority relationship to capacity work

F1-F5 are the owner-prioritized implementation sequence. The production-like
TLS 1k gate in `docs/capacity-plan.md` remains mandatory, unchanged, and
unproven; it is queued after F5 rather than canceled. Frontend browser, bundle,
or responsiveness results are never capacity evidence.

## AI handoff protocol

For every phase, update this document, `frontend-architecture.md`, `AGENTS.md`,
and `AI_HANDOFF.md` with implemented scope, browser evidence, known gaps, and
one exact next task. Do not mark a phase complete from static screenshots alone:
verify API request count, navigation, error recovery, desktop, and mobile.
