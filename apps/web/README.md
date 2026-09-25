# ProSlides web

React/Vite TypeScript client for the Go HTTP/SSE API.

## Architecture

Application source follows the enforced dependency direction:

```text
app -> modules -> shared
```

Ordinary REST state uses the shared HTTP/error boundary and TanStack Query where
migrated. Live state remains a dedicated typed snapshot + HTTP command + SSE
runtime because ordering, replay and reconnect are domain behavior.

The v2 redesign keeps this foundation and moves product rendering toward:

- a stable Editor shell with Content and Activity registries;
- an audience Stage;
- presenter-only Backstage;
- a mobile-first Participant projection.

Do not add team/self-paced UI during v2.0.

Read:

- `../../docs/status/current.md` for current state;
- `../../docs/v2-product-architecture.md` for v2 product/domain rules;
- `../../docs/v2-development-plan.md` for implementation order;
- `../../docs/frontend-architecture.md` for technical boundaries;
- `../../docs/frontend-professionalization.md` for Persian UX/design rules;
- `../../docs/frontend-debt.md` for intentionally deferred debt;
- ADR 0003 and ADR 0004 for durable rationale.

## Development

Install once after dependency/lockfile changes:

```sh
npm ci
```

Run the development server:

```sh
npm run dev
```

Fast verification for ordinary frontend work:

```sh
npm run lint
npm run typecheck
npm run architecture:check
npm run test:unit
npm run test:component
```

Run `npm run api:types:check` when OpenAPI/generated types may be affected and
`npm run build` when dependencies, route splitting, styles or bundle shape may
change.

`npm run test:e2e` is a broader integration check, not a mandatory local step
for every pre-production visual iteration. Use it for affected critical flows or
production-readiness hardening.

Playwright starts/reuses Vite on port 4173 and expects the Go API on port 8080.
If managed Chromium is unavailable, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chrome executable.

## API and auth

`VITE_API_BASE_URL` and `VITE_LIVE_API_BASE_URL` default to same-origin
`/api/v1`. "ProSlides v2" is the product architecture program; it does not
currently create a parallel HTTP `/api/v2`.

Authentication uses opaque server-side sessions, HttpOnly cookies and CSRF.

## Production image

The Docker image builds the Vite artifact with Node 22 and serves it through
Nginx on port 8080 with SPA fallback, security/cache headers, same-origin API
proxying and unbuffered SSE. See `../../docs/deployment-runbook.md`.
