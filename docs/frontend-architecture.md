# ProSlides frontend architecture

## Purpose

This document defines the durable frontend architecture. Current implementation
status belongs in `status/current.md`; remaining debt belongs in
`frontend-status.md`; completed F0-F5 history is archived in
`archive/frontend-f0-f5-2026-08.md`.

If frontend work changes an external API route, event, error contract or
persistent value, OpenAPI/backend rules take precedence.

## Architectural goals

- Preserve editor revision/conflict correctness and live HTTP/SSE recovery.
- Converge incrementally on a modular TypeScript SPA without a rewrite.
- Keep product-domain ownership explicit.
- Use one design-system vocabulary and one REST server-state cache.
- Keep live event state separate from generic REST caching.
- Make Persian/RTL, accessibility, responsive behavior and cancellation normal
  completion criteria rather than follow-up polish.

## Source layout

```text
src/
  app/
    main.tsx
    router/
    providers/
    layouts/
    errors/

  modules/
    identity/
      api/
      model/
      forms/
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

    live/
      api/
      runtime/
      react/
      manager/
      participant/
      ui/

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
      client/
    forms/
    ui/
      primitives/
      patterns/
    styles/
    i18n/
    storage/
    config/
    lib/
    test/
```

This is a boundary map, not a request to create empty directories.

## Dependency rules

```text
app -> modules -> shared
```

- `shared` cannot import `modules` or `app`.
- A module may use another module only through an intentional public contract.
- Private UI/state of another module is never an import surface.
- Presentation dashboard/editor/sharing share one presentation domain.
- Reports consume report DTOs/domain models, not editor-internal state.
- Manager and participant live containers remain role-separated.
- A helper used by one module stays in that module.
- New generic `components`, `hooks`, `services`, or `utils` dumping grounds
  are prohibited.

Dependency rules should be enforced by lint/dependency tooling rather than
source-string tests as the migration progresses.

## Routing

Use React Router data routing for one static route tree with nested layouts,
route-level pending UI and route error boundaries. Keep the Vite SPA and Nginx
fallback; SSR/framework migration requires a separate measured need.

Target route ownership:

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

The direct one-segment access-code route remains for product compatibility.
Static routes must be explicit and reserved paths validated so the generic
route never becomes the application router.

## State ownership

| State | Owner |
|---|---|
| route/params/search state | React Router |
| REST identity/presentation/report state | one TanStack Query client after migration |
| editor draft/selection/dirty/save/conflict | presentation editor model/reducer/hooks |
| live snapshot/cursor/reconnect/roster | dedicated typed live runtime |
| field/open-dialog/selected-tab transient state | local component/form state |
| global cross-route notices | one accessible notice system |

Do not add Redux/Zustand/XState solely to centralize state. Introduce a global
store only for a demonstrated cross-domain ownership problem.

## Forms and validation

Use native semantic controls underneath source-owned UI primitives.

For ordinary business forms (identity, settings, report filters and similar),
React Hook Form + Zod is the preferred target:

- UI primitives do not depend on React Hook Form.
- RHF adapters live in `shared/forms` only when reused.
- Feature schemas live with the feature/domain.
- Client schemas mirror backend constraints but never replace backend
  validation.
- Server field errors map back to the relevant field; transport/global errors
  use shared feedback patterns.

The editor is not one giant form. Its draft/revision/ordering state remains a
domain model; RHF may be used for isolated subforms where it reduces complexity.

### Persian numeric input

Accept Persian, Arabic-Indic and ASCII digits where the product expects a
numeric value, normalize before domain validation, and serialize API numeric
values canonically.

Identifiers that merely contain digits remain strings, including OTPs, phone
numbers, access codes, card-like identifiers and IDs. Prefer `inputmode` for
mobile keyboard hints rather than coercing identifiers through
`<input type="number">`.

## API boundary

Create one ordinary REST HTTP boundary responsible for:

- base URL construction;
- credentials and CSRF;
- JSON parsing;
- stable typed API errors;
- `AbortSignal` propagation;
- safe auth-expiry notification.

Generated OpenAPI types describe transport only. Convert transport DTOs to
frontend domain models at module boundaries.

### Error contract

The backend error schema should evolve toward a stable machine-readable shape
rather than requiring clients to parse human-readable text:

```ts
type ApiErrorResponse = {
  code: string;
  message?: string;
  field_errors?: Record<string, string[]>;
  retry_after_seconds?: number;
  request_id?: string;
  details?: unknown;
};
```

Error handling must distinguish validation, authentication, authorization,
not-found, conflict, rate-limit, network, abort and server failures. Aborted
requests normally do not produce user-facing error feedback.

Do not add Axios merely as a second HTTP abstraction. Native fetch is sufficient
for the current requirements; a different client needs a concrete capability
gap.

## REST server state

TanStack Query is the target cache for ordinary REST server state.

- Query functions consume the provided `AbortSignal`.
- Router loaders may prefetch the same query client; they do not maintain a
  second cache.
- Read retries are explicit and status-aware.
- Mutation retries are disabled by default unless the operation is proven
  idempotent and its revision/request-ID semantics are preserved.
- Cancellation is not an undo guarantee; a backend transaction may have
  committed before the client stops waiting.

The live SSE runtime is not stored in TanStack Query.

## Live runtime

The long-term live boundary is:

```text
modules/live/api       HTTP + SSE transport
modules/live/runtime   typed state, cursor/order, reconnect, command rules
modules/live/react     provider/hooks adapter
modules/live/manager
modules/live/participant
```

The runtime must preserve:

- snapshot-before-SSE;
- monotonic event/state handling;
- stable request IDs;
- manager expected-state versions;
- participant non-disclosure;
- bounded manager roster pages;
- authoritative server timer/deadline semantics.

React context should expose the runtime, not contain the full protocol
implementation indefinitely.

## TypeScript

- New frontend source is TS/TSX.
- Migrate domain/API/storage/router boundaries before cosmetic leaf files.
- Do not mechanically rename JSX to TSX while keeping broad `any` and
  unvalidated object bags.
- Manager/participant snapshots use discriminated types.
- A green `tsc` is not full frontend coverage while active JSX remains.

## Design system

Use Tailwind CSS 4 plus CSS custom properties with one semantic token
vocabulary. Do not mix a second unbacked shadcn token dialect with product
tokens.

Required semantic groups include:

- canvas/surface/raised/overlay;
- content/muted/subtle/inverse;
- border/focus;
- accent and interaction states;
- success/warning/danger/info;
- typography/spacing/radius/shadow/motion.

Different product areas may have different themes while sharing the same token
contract and interaction semantics. Runtime presentation themes may override a
safe subset such as background/foreground/accent, not accessibility semantics.

Simple buttons/fields may be native/source-owned. Use accessible headless
primitives for dialogs, alert dialogs, menus, popovers, tabs and tooltips; do
not hand-roll focus trapping/restoration when a proven primitive exists.

## RTL, mixed content and motion

- Persian product chrome is RTL.
- Prefer logical start/end layout behavior over physical left/right.
- Access codes, URLs, emails and technical identifiers use explicit LTR.
- User-authored content uses `dir="auto"` or `bdi`.
- Motion is functional and short, with `prefers-reduced-motion` behavior.
- Live effects have bounded lifetime and never block commands.

## Accessibility and responsive contract

Target WCAG 2.2 AA for product flows.

Completion includes keyboard access, visible/unobscured focus, names for icon
controls, modal focus containment/restoration, alternatives to pointer-only
reordering, meaningful live regions, practical touch targets, safe-area-aware
mobile controls and no horizontal overflow.

Retain 390x844 and 1440x900 as regression anchors, but add intermediate and
container-driven checks when component layout changes. Use container queries
where component behavior depends on available component space rather than the
global viewport.

## Testing

Target test stack:

- existing Node protocol/domain tests during migration;
- Vitest for new TS domain/component tests;
- Testing Library for user-visible component behavior;
- MSW for API success/failure/conflict/cancellation states;
- axe for accessibility smoke;
- Playwright for real critical flows;
- limited visual snapshots only for stable states.

Critical vertical slices test pending, success, recoverable error and relevant
conflict/reconnect/cancellation behavior. The complete manager/participant live
lifecycle should become a deterministic CI gate.

Architecture dependency rules should be enforced with dedicated lint/dependency
tooling. Dead files/exports/dependencies should be checked with a tool such as
Knip after the migration baseline is stable.

## Performance and observability

Preserve route isolation and checked bundle ceilings. Do not preload
editor/live-heavy code into landing/auth without evidence.

Local Web Vitals are regression evidence, not field performance. Before making
field-performance claims, collect privacy-safe RUM for Core Web Vitals and
frontend error/route/API/SSE recovery signals with bounded metadata and release
identification.

## Migration order

1. Standardize backend/frontend machine-readable error contracts.
2. Converge design-system primitives and tokens.
3. Introduce RHF/Zod form foundation for ordinary forms.
4. Introduce the single TanStack Query REST cache through identity/reports.
5. Enforce dependency boundaries and continue TypeScript module migration.
6. Extract typed live runtime from React context.
7. Add component/API-state tests and CI browser lifecycle gating.
8. Upgrade major toolchain pieces in isolated, compatibility-tested changes.

Do not combine these migrations into one rewrite.
