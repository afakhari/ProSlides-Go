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

The source audit found 78 JS/TS/CSS files and about 18,300 nonblank lines: 54
JSX, 15 JS, 7 TS, and no TSX files. `tsconfig.json` checks only TS, so the
passing typecheck excludes most UI; ESLint checks JS/JSX but not TS. Four UI
files exceed 1,000 nonblank lines. `App.jsx` retains unreachable legacy runtime
after the active route table, production paths still import mock-era view
models, and the editor carries duplicate legacy/canonical fields.

Styles contain roughly 381 direct color expressions, 75 inline style objects,
and 169 physical-direction utilities. Tailwind is imported twice and several
semantic component classes have no defined token. Static legacy imports also
preload DnD and motion on the landing route (about 252 KiB gzip). Blindly
removing manual chunks produced a 736 KiB raw entry in an experiment, so dead
code removal and route isolation must precede chunk tuning.

The browser rerun passed responsive auth. Authenticated E2E could not be
repeated against the four-day-old running Web image because its old Nginx
startup state returned API proxy 500s. This is environment drift rather than a
frontend assertion failure; rebuild/recreate API and Web before the next
browser gate without deleting volumes.

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

### Phase F1 — creation-to-editor continuity

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

### Phase F2 — Persian app shell and design system

- Introduce shared application shell, tokens, typography, and semantic colors.
- Translate dashboard, editor chrome, share flow, reports, and common dialogs.
- Establish one RTL/LTR boundary for content such as URLs and access codes.
- Replace mixed alerts/toasts with one accessible feedback system.
- Remove or mark non-functional header/editor controls.
- Remove the duplicate Tailwind import and replace touched direct colors and
  physical-direction styles with semantic tokens and logical properties.

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
