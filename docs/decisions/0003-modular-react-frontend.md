# ADR 0003: Incremental modular React frontend

## Status

Accepted for incremental migration — 2026-08-28

## Context

The React client has complete functional coverage for the active Go product
flows, but it still contains two frontend generations at once. The current
source mixes a typed Go HTTP/SSE boundary with legacy numeric-message view
models, production imports from mock fixtures, large route components, partial
TypeScript coverage, direct visual values, and inconsistent Persian/English
application chrome.

A full rewrite would put verified editor concurrency, idempotent live commands,
snapshot/SSE recovery, and participant non-disclosure at unnecessary risk. A
microfrontend or framework migration would also add operational complexity
without solving the current module and UI-boundary problems.

## Decision

Keep React 19 and Vite and migrate the existing client incrementally to a
module-oriented TypeScript SPA.

- Organize product code into `identity`, `presentations`, `live`, `reports`,
  and `marketing` modules. The presentation editor belongs inside the
  `presentations` module rather than becoming an unrelated top-level domain.
- Dependencies flow from `app` to `modules` to `shared`. Shared code must not
  import product modules, and modules must not import another module's private
  implementation.
- React Router owns route matching, layouts, navigation state, and route error
  boundaries. REST server-state caching may use one TanStack Query client;
  route loaders may prefetch that same cache but must not create a second data
  store.
- Live HTTP/SSE state remains a dedicated typed transport and reducer. It must
  preserve snapshot-first recovery, event/state cursor rules, stable request
  IDs, bounded manager roster pages, and manager/participant disclosure
  boundaries. It is not stored as a generic REST query cache.
- Tailwind CSS 4 remains the styling engine, with CSS-first semantic theme
  tokens and source-owned UI primitives. Runtime presentation colors and
  safe-area values remain CSS custom properties rather than being forced into
  static brand tokens.
- Persian is the default product language. New application shells are RTL;
  existing routes migrate to logical direction properties before document-wide
  RTL is enabled. User-authored slide content uses `dir="auto"`; URLs, emails,
  access codes, and technical identifiers use explicit LTR boundaries.
- New source is TypeScript. Existing JavaScript migrates module by module;
  there is no bulk rename that converts untyped code without defining its
  domain boundary.
- Existing Node unit and Playwright coverage remains during migration. New
  component coverage uses the Vite-native test path defined in
  `../frontend-architecture.md`.

## Consequences

- The migration can deliver visible Persian UX improvements without pausing
  verified product behavior for a rewrite.
- Some compatibility adapters remain temporarily, but every adapter has an
  explicit removal phase and production mock imports are prohibited.
- Manager and participant UIs may share visual primitives while retaining
  separate role-scoped containers and types.
- No Redux, Zustand, XState, Next.js, microfrontend, standalone design-system
  package, or offline mutation queue is introduced without a separately
  documented measured need.
- Frontend work must satisfy the route-specific acceptance gates in
  `../frontend-professionalization.md`; capacity proof remains an independent
  production gate.

## Detailed reference

The current evidence, target directory layout, dependency rules, migration
sequence, testing strategy, and completion criteria live in
[`../frontend-architecture.md`](../frontend-architecture.md).

