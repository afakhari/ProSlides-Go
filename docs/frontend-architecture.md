# ProSlides frontend architecture and migration plan

## Purpose and authority

This document is the implementation source of truth for professionalizing the
React client. It records the current state, the target structure, the rules
that preserve Go editor/live correctness, and the ordered migration path. The
experience acceptance criteria live in `frontend-professionalization.md`; the
durable backend and HTTP/SSE boundaries live in `architecture.md` and OpenAPI.

If a frontend change alters an API route, event, error, or persistent value,
OpenAPI and the backend workflow still take precedence. Visual work must not
weaken idempotency, revision conflicts, role-scoped snapshots, or recovery.

## Current state — audited 2026-08-28

The active UI is functional, but it is not yet a modular TypeScript frontend.
The measured source facts are:

- the pre-F1 audit counted 78 JavaScript/TypeScript/CSS source files and about
  18,300 non-blank lines; the post-F2-foundation tree has 54 `.jsx`, 15 `.js`,
  10 `.ts`, and 4 `.tsx` files;
- `tsconfig.json` includes `src/**/*.ts` and `src/**/*.tsx`, so the successful typecheck still does
  not validate most components or routes;
- several components have more than 1,000 non-blank lines, including the
  dashboard, auth screen, editor, and editor sidebar;
- `App.jsx` contains the active route table plus an unreachable legacy
  presentation runtime after the component return; its static imports still
  affect the production bundle;
- the active live route is snapshot/SSE based, but `ServerDataContext` and
  `live/protocol.js` project typed state back into retired numeric-message and
  legacy quiz view models;
- production components still import `src/data/mockData.js`, contrary to the
  documented mock-only rule;
- the editor domain duplicates legacy and canonical field names such as
  `title`/`quiz_name`, `text`/`question_text`, and
  `time_limit`/`question_time`;
- the first F2 slice removed the duplicate Tailwind import and introduced a
  complete CSS-first semantic token source for migrated surfaces; direct visual
  values remain in routes outside dashboard/editor/share and migrate by phase;
- static inspection found 381 direct color expressions, 75 inline style
  objects, and 169 physical direction utilities. Inline runtime presentation
  theming is legitimate; repeated brand/layout values are not;
- product chrome mixes Persian and English, and dashboard, loading, editor,
  auth, and public-join screens do not yet share one visual system;
- lint, the current partial typecheck, 37 unit tests, and a production Vite
  build pass.

### Browser and bundle evidence

A 2026-08-28 system-Chrome F2 run against the current Vite source completed
registration, dashboard creation, editor loading, access-code save, and share
at 1440x900 and 390x844. Dashboard/editor/share screenshots were inspected;
mobile document/client widths matched, computed title/code directions were
RTL/LTR, and the browser reported zero console errors. This supersedes the
earlier authenticated run blocked by a stale Web image for these surfaces only.

The checked-in manual chunk rules produce an initial HTML preload of roughly
252 KiB gzip across the entry, React, DnD, motion, and miscellaneous chunks.
Removing manual chunks experimentally reduced the initial gzip total to about
211 KiB but created one 736 KiB raw entry chunk. Neither configuration is the
target. First remove dead static imports and enforce route isolation, then
measure and tune exact package chunks. Do not set an arbitrary final budget
from this local build alone.

## Product-specific invariants

Every frontend migration must preserve all of the following:

1. HTTP mutation responses are definitive; the UI does not wait for an SSE
   echo to decide whether a command succeeded.
2. Retried live mutations reuse their stable `request_id`. Manager commands
   also use the latest `expected_state_version`.
3. Presentation writes retain `If-Match` revision behavior and expose a
   recoverable edit-conflict state rather than silently overwriting.
4. Live clients fetch a role-scoped snapshot before SSE and resume from its
   `last_event_id`. Equal state versions with newer event IDs remain valid.
5. Participant code cannot retain a manager roster, score map, or question
   correctness metadata.
6. Direct public `/{accessCode}` links continue to resolve without exposing
   manager fields.
7. PostgreSQL remains authoritative. Browser storage may hold display hints,
   stable retry IDs, and bounded recovery state, never the durable score or
   answer ledger.
8. User-authored presentation content may be Persian, English, or mixed and
   must not inherit an incorrect forced direction.

## Target source layout

```text
src/
  app/
    main.tsx
    providers/
    router/
    layouts/

  modules/
    identity/
      api/
      model/
      routes/
      ui/

    presentations/
      api/
      model/
      dashboard/
      editor/
        routes/
        model/
        canvas/
        slide-list/
        inspector/
        toolbar/
      sharing/
      tests/

    live/
      api/
      model/
      manager/
      participant/
      shared-ui/
      tests/

    reports/
      api/
      model/
      routes/
      ui/

    marketing/
      routes/
      ui/

  shared/
    api/
      generated/
    ui/
    styles/
    i18n/
    storage/
    config/
    lib/
    test/
```

This is a boundary map, not a requirement to create every empty directory in
advance. Create a directory only with the first real file that belongs there.

### Dependency rules

```text
app -> modules -> shared
```

- `shared` cannot import from `modules` or `app`.
- A module may consume another module only through a deliberately exported
  public type or use case; private UI and internal state are not cross-module
  APIs.
- Dashboard, editor, and sharing use the canonical presentation model because
  they are subfeatures of the same product module.
- Reports use report DTOs and identifiers, not editor-internal slide state.
- Manager and participant live containers remain separate. They may share
  visual components that require only public props.
- Avoid generic `components`, `utils`, and `hooks` dumping grounds. A helper
  that is used by one module stays in that module.

## Routing and application composition

Use React Router data routing for one static route tree, nested layouts,
route-level pending UI, and error boundaries. Keep the Vite SPA and Nginx
fallback; do not adopt React Router framework mode, SSR, or Next.js solely for
this refactor.

```text
/
|-- marketing layout
|   |-- /
|   `-- /team
|-- account layout
|   |-- /auth
|   `-- /reset-password
|-- protected manager layout
|   |-- /manager/panel
|   |-- /manager/panel/:presentationId
|   `-- /manager/panel/:presentationId/report
|-- live layout
|   |-- /manager/presentation/:sessionId
|   |-- /player/presentation/:sessionId
|   `-- /:accessCode
`-- not found
```

Keep the direct one-segment access-code route for product compatibility, but
define static/protected routes explicitly and validate reserved paths so the
generic route never becomes the application router.

Route modules may prefetch the one REST cache described below. They must not
keep a second copy of presentation/report data in router-local state.

## Data, state, and side effects

Use the smallest owner for each state category:

| State | Owner |
|---|---|
| route, params, search/filter URL | React Router |
| remote identity/presentation/report data | one REST query cache after its migration phase |
| editor draft, selection, dirty/save/conflict UI | presentation editor reducer/hooks |
| live snapshot, cursor, reconnect, roster pages | dedicated typed live runtime |
| open dialog, selected tab, transient field | local component state |
| global notices | one accessible notice provider |

TanStack Query is optional until the central HTTP boundary is ready. If added,
it is the only REST server-state cache. Router loaders call the same query
client for prefetching. Automatic retries are allowed for safe reads; mutation
retry is explicit and must preserve the request/revision semantics of the
operation.

Do not put the live event stream in the REST query cache and do not recreate
the server state machine with XState. The Go live module remains authoritative.

## API and domain boundary

Create one shared HTTP client responsible only for:

- base URL construction;
- credentials and CSRF headers;
- JSON parsing and a stable typed API error;
- `AbortSignal` propagation;
- safe authentication-expiry notification.

Generate compile-time API types from the checked-in OpenAPI document and check
generation drift in CI. Generated types describe transport; they do not replace
frontend domain models. Convert slide content into discriminated presentation
types at the module boundary and remove duplicate legacy names from UI state.

Keep `liveApi` and SSE parsing specialized. Remove `ServerDataContext`, numeric
message conversion, legacy `QuizSetup` fallbacks, and old JWT helpers only when
their active consumers have migrated and browser flows pass.

## TypeScript migration

- New frontend files are `.ts` or `.tsx` and use strict settings.
- Extend linting to TypeScript before claiming complete static coverage.
- During transition, include JavaScript in the project without enabling a
  repository-wide flood of unreviewed `checkJs` failures.
- Migrate boundaries first: API errors/contracts, domain models, storage,
  router, and shared primitives. Then migrate dashboard/reports, editor, and
  live UI in that order.
- Do not rename a component to `.tsx` while leaving its meaningful values as
  broad `any` or unvalidated `Record<string, unknown>` throughout the UI.
- Treat manager and participant snapshots as a discriminated union and keep
  disclosure-safe selectors typed.

## Styling, RTL, and motion

Use one Tailwind CSS 4 integration and one import. Define brand and semantic
tokens in CSS-first `@theme`; use ordinary CSS custom properties for runtime
values that should not create utilities.

Token groups include:

- brand and interaction colors;
- surface, raised surface, border, and overlay;
- text, muted text, and inverse text;
- success, warning, danger, and information;
- font families, type scale, spacing, radius, shadow, focus ring, and motion.

`Vazirmatn` is the default Persian interface font. `Outfit` is reserved for
Latin brand text and explicit LTR data. Migrate physical layout utilities to
logical start/end behavior route by route. New shells are RTL, while the root
document becomes RTL only after the affected existing routes pass desktop and
mobile visual checks.

Use `dir="ltr"` for access codes, URLs, emails, and identifiers and `dir="auto"`
or `bdi` for user-authored content. Do not globally right-align every value.

Normal interface motion is functional and short. Every animation and
transition must have a reduced-motion behavior. Confetti, reaction, timer, and
live-result effects also need bounded lifetime and must not block commands.

## UI primitives and feedback

Keep native elements for ordinary buttons and fields. Use accessible headless
primitives only for interactions with complex focus/keyboard behavior, such as
alert dialogs, dialogs, menus, popovers, tabs, and tooltips. Source-owned
shadcn-style components are acceptable; parallel shadcn runtime packages are
not.

The shared UI layer initially contains only components required by migrated
flows: button, field, alert, alert-dialog, toast/status region, skeleton,
empty-state, and error-state. Do not create a separate package or Storybook
until stable reuse across enough components or a second frontend justifies it.

One feedback policy applies everywhere:

- pending state blocks accidental duplicate submission and is announced;
- success is visible when the result is not otherwise obvious;
- validation remains near its field;
- recoverable API/network errors keep user context and offer retry;
- destructive operations use one accessible alert-dialog;
- edit conflicts explain that newer server data won and offer reload/reapply;
- native `alert()` and competing modal/notice systems are retired.

Hide controls that have no behavior. Do not ship placeholder Upgrade,
notification, language, chat, reaction, or media controls as if they work.

## Accessibility and responsive contract

Target WCAG 2.2 AA for product flows. Completion includes:

- semantic headings, landmarks, fields, and tables;
- keyboard access and visible, unobscured focus;
- accessible names for icon controls;
- focus trapping/restoration in modal interactions;
- an alternative to pointer-only drag/reorder;
- live regions for relevant async state without excessive announcements;
- minimum practical touch targets;
- no horizontal page overflow at 390x844;
- safe-area-aware mobile editor/live controls;
- reduced motion at the OS preference.

Required viewports remain 1440x900 and 390x844. Add intermediate responsive
checks when a component changes layout rather than only shrinking.

## Test strategy

Preserve the existing Node protocol/domain tests while migrating. New coverage
uses:

- Vitest for TypeScript domain and component tests;
- Testing Library for user-visible component behavior;
- MSW for API boundary success, failure, conflict, and cancellation cases;
- axe-based smoke checks for migrated route/component accessibility;
- checked-in Playwright for real identity, dashboard/editor, report, public
  join, manager/player live, reconnect, and responsive flows;
- limited visual snapshots for stable critical states, not broad snapshots of
  dynamic live data.

Every migrated vertical slice tests pending, success, recoverable error, and
the relevant conflict/reconnect behavior. Live tests also assert request count,
stable request IDs, role non-disclosure, and event ordering.

## Performance policy

Measure before setting final byte or Web Vital targets. The first enforceable
gates are structural:

- landing and auth do not preload editor, DnD, emoji, reaction, or live-manager
  code;
- editor-only and live-only dependencies stay behind their route boundary;
- a PR does not increase initial gzip or route chunks without a recorded reason;
- fonts and stable assets retain immutable caching;
- large avatar/demo assets are not imported by the application entry;
- manual chunks use exact package boundaries after dead imports are removed,
  not substring rules that group unrelated React-named packages.

Record production build sizes during the migration, then set mobile Web Vital
and bundle budgets from real Chrome evidence on the supported topology.

## Ordered migration

### F0 — documentation and baseline

- **Complete 2026-08-28:** aligned `AGENTS.md`, `AI_HANDOFF.md`, this document,
  the UX roadmap, root/Web READMEs, migration status, and mock-data guidance.
- Recorded source/type/style/dependency/bundle evidence and the successful
  responsive-auth browser observation.
- Recorded two environment prerequisites for F1: the local `.git` worktree
  pointer is stale, and API/Web images must be rebuilt/recreated before browser
  acceptance. Neither was silently changed as part of the documentation audit.
- Deferred enforceable production-mock-import and bundle checks to F4/F5, when
  their active consumers and accepted baselines are migrated.

### F1 — creation-to-editor continuity — complete 2026-08-28

- Keep mutation progress in the dashboard and prevent duplicate creation.
- Remove artificial loading delay from the affected flow.
- Navigate with explicit creation context.
- Render an editor-shaped skeleton instead of the generic full-screen loader.
- Show a Persian first-presentation empty state and the next useful action.
- Continue directly into slide-type selection after the first draft creation.
- Cover failure, reduced motion, 1440x900, 390x844, and exact API request count.

### F2 — application foundation — complete

- **Completed first slice 2026-08-28:** one CSS-first semantic token source,
  typed accessible `Notice`, Persian dashboard/editor/share feedback, explicit
  title/access-code direction boundaries, and removal of native alerts plus the
  duplicate Tailwind import in that slice.
- **Completed second slice 2026-08-28:** persistent authenticated manager shell,
  route-local pending/error recovery, and typed Persian catalog consumed by
  dashboard/editor/share.
- **Completed third slice 2026-08-28:** typed shared HTTP/API-error boundary for
  manager presentation reads/mutations with preserved CSRF, abort, revision,
  request-count, conflict, and auth-expiry behavior.
- **Completed fourth slice 2026-08-29:** checked OpenAPI-generated presentation
  and slide transport types with a deterministic CI drift check; editor domain
  types remain separate and no query cache was added.
- Continue strict TypeScript at shared/module boundaries.
- Keep any future REST query-cache decision separate from transport generation.

### F3 — presentations and editor — complete

- Migrate dashboard, sharing, canonical presentation models, and editor UI into
  the presentation module.
- Split editor canvas, slide list, inspector, and toolbar.
- Expose one save/dirty/conflict model and one responsive slide navigator.
- Preserve revision and validation behavior throughout.

Completed 2026-08-29: presentation API/model, dashboard, sharing, and editor
UI are owned by `modules/presentations`. Editor routes, canvas, slide list,
inspectors, toolbar, and status model are separated. Creation is type-first,
so canceling selection creates no durable draft; choosing a type sends one
request. Responsive slide navigation retains mobile safe-area behavior, and a
single dirty/save/conflict model exposes reload recovery without changing
revision or validation semantics.

### F4 — live runtime and role UI

- Replace legacy projections with typed reducer/selectors.
- Remove production mock fallback and numeric message handling.
- Keep role-specific manager/participant containers and storage adapters.
- Verify recovery, event ordering, timers, final results, and non-disclosure.

### F5 — quality closure

- Finish Persian/RTL migration and accessibility audit.
- Consolidate tests and feedback, remove unused dependencies/assets, and set
  measured bundle/Web Vital gates.
- Update browser evidence and remove compatibility files only after all active
  flows pass.

## Completion and documentation

A phase is complete only when its route behavior, error states, Persian copy,
RTL/LTR boundaries, accessibility, responsive layouts, tests, build evidence,
and operational consequences agree. Static screenshots alone are not proof.

For every material phase update:

- `AGENTS.md` current state, exact next task, and change log;
- `AI_HANDOFF.md` current objective, verification, and next task;
- `frontend-professionalization.md` experience evidence and acceptance;
- this document when a boundary, dependency rule, target structure, or
  migration order changes;
- ADR 0003 only when the architectural decision itself is superseded.

Capacity proof remains independently governed by `capacity-plan.md`. Frontend
completion does not promote the production-like 1k/5k/10k gates.
