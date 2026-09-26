# ProSlides frontend architecture

## Purpose

This document defines the durable frontend architecture. Current implementation
status belongs in `status/current.md`; remaining debt belongs in
`frontend-debt.md`; completed F0-F5 history is archived in
`archive/frontend-f0-f5-2026-08.md`.

If frontend work changes an external API route, event, error contract or
persistent value, OpenAPI/backend rules take precedence.

## Architectural goals

- Preserve editor revision/conflict correctness and live HTTP/SSE recovery.
- Preserve the modular TypeScript SPA and current v2 product/domain boundaries.
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

Dependency rules are enforced by lint/dependency tooling rather than ad-hoc
source-string ownership checks.

## Routing

Use React Router data routing for one static route tree created outside the
React render tree and rendered through `RouterProvider`. Route modules may use
`route.lazy` to preserve code splitting while loaders/actions remain part of
the router lifecycle. Nested layouts, route-level pending UI and route error
boundaries are router concerns, not duplicated component-local lifecycle
machines.

Protected-route identity checks use the shared TanStack Query client and typed
identity API. Loaders may call `fetchQuery`/prefetch the same query definition
used by components; they must not create a second session cache or a parallel
raw-fetch abstraction. Authentication failures redirect explicitly,
while network/server failures surface through route recovery UI rather than
being misclassified as logout.

Keep the Vite SPA and Nginx fallback; SSR/framework migration requires a
separate measured need.

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
| REST identity/presentation/report state | one shared TanStack Query client |
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

Use `shared/api/http.ts` as the single ordinary REST HTTP boundary. Legacy
top-level API URL/fetch helpers are not compatibility surfaces and must not be
reintroduced.

The boundary is responsible for:

- base URL construction and rejection of caller-supplied absolute request URLs;
- credentials and CSRF;
- JSON parsing;
- stable typed API errors;
- `AbortSignal` propagation;
- safe auth-expiry notification.

Generated OpenAPI types describe transport only. Convert transport DTOs to
frontend domain models at module boundaries.

The live module keeps its dedicated HTTP/SSE transport because it has a
protocol-specific base URL, event-stream lifecycle and request-ID/state-version
semantics. It must not become a second generic REST client for ordinary product
queries.

### Error contract

The backend error schema should evolve toward a stable machine-readable shape
rather than requiring clients to parse human-readable text:

```ts
type ApiErrorResponse = {
  error: string; // stable machine-readable code; retained for API compatibility
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

React context exposes the runtime controller through a thin external-store adapter. Cursor, reconnect, roster and command state belong to `modules/live/runtime`, not to React lifecycle state.

## ProSlides v2 frontend model

ADR 0004 and `v2-product-architecture.md` define the current product model.

The Editor uses one stable shell containing an item rail, canvas, inspector and
top actions. Type-specific behavior is supplied through two
bounded registries:

- a content registry for non-interactive authored items;
- an activity registry for audience interactions.

A registry entry may own default definition creation, validation adaptation,
Editor canvas/inspector rendering, Stage rendering, participant rendering and
results rendering for its type. It must not become a generic service locator or
bypass module ownership.

Live rendering uses three explicit projections:

- Stage for the audience;
- Backstage for presenter-only controls and insight;
- Participant for mobile-first personal interaction.

Activity results and cumulative Session ranking are separate UI/domain
concepts. The authoring rail contains only persisted Items; Activity-result and
optional overall-ranking behavior is shown as metadata on the owning Activity
rather than as a selectable synthetic ranking entry.

v2.0 intentionally excludes team mode and self-paced/assignment UI. Do not add
speculative frontend state for those modes.

## TypeScript

- Application source under `apps/web/src` is TypeScript/TSX.
- New boundaries remain typed; do not reintroduce JavaScript compatibility
  leaves.
- Transport DTOs, persisted definitions and live snapshots are converted into
  explicit module/domain types at their boundaries.
- Manager/participant snapshots use discriminated types.
- A green `tsc` is a compile-time guardrail, not behavioral verification.

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

New or materially changed controls should keep semantic HTML, accessible names,
keyboard reachability and obvious focus behavior intact while they are being
built. Exhaustive keyboard/screen-reader sweeps, viewport matrices and contrast
audits may be consolidated into the pre-production hardening phase while the UI
is still undergoing broad redesign.

Retain 390x844 and 1440x900 as production-readiness regression anchors. During
active redesign, check the viewport(s) materially affected by the current slice
instead of running the full matrix after every iteration. Use container queries
where component behavior depends on available component space rather than the
global viewport.

## Testing

Target test stack:

- existing Node protocol/domain tests for stable domain invariants;
- Vitest for fast TS domain/component tests;
- Testing Library for user-visible behavior rather than DOM structure;
- MSW for API success/failure/conflict/cancellation states when those behaviors
  are risky or actively changing;
- axe for focused accessibility smoke;
- Playwright for a small set of real critical flows;
- limited visual snapshots only after a surface is visually stable.

### Pre-production verification policy

The project is still pre-production, but the broad v2 redesign is complete.
Tests should protect expensive-to-rediscover behavior without expanding
maintenance cost solely to increase coverage.

For ordinary changes:

- keep fast structural guardrails such as TypeScript, lint, OpenAPI consistency,
  dependency boundaries and existing stable unit/component tests;
- add or update tests when a slice changes high-risk behavior such as editor
  revision/conflict handling, live protocol/reconnect rules, auth boundaries,
  cancellation, mutation idempotency or recovery;
- prefer assertions on roles, outcomes, requests and state transitions over DOM
  hierarchy, Tailwind classes, exact layout or incidental copy;
- do not expand component coverage merely to improve a coverage percentage;
- extend broad E2E or visual-regression coverage when a stable surface or costly
  invariant justifies the maintenance cost;
- investigate integration failures that plausibly indicate a real regression in
  the changed area.

### Production-readiness verification

Repository-level V2.8 hardening now enforces critical Playwright flows,
repeatability, responsive/accessibility checks, selective stable visual
baselines, container/restore/retention drills, and conservative
dead-file/export/dependency analysis. Environment-only capacity, alerting,
provider restore/RPO/RTO and rollout/rollback evidence remain release gates in
`status/current.md`.

Architecture dependency rules remain enforced continuously. Intentional
non-static tooling dependencies require an explicit reviewed exemption rather
than being silently ignored.

## Performance and observability

Preserve route isolation and checked bundle ceilings. Do not preload
editor/live-heavy code into landing/auth without evidence.

Local Web Vitals are regression evidence, not field performance. Before making
field-performance claims, collect privacy-safe RUM for Core Web Vitals and
frontend error/route/API/SSE recovery signals with bounded metadata and release
identification.

## Evolution policy

The completed v2 delivery sequence is archived under `archive/`. Future
frontend changes preserve the dependency rules in this document and should not
mix product/domain changes with unrelated framework/toolchain upgrades unless a
measured need requires it.
