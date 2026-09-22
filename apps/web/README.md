# ProSlides web

React/Vite client for the Go HTTP/SSE API.

## Architecture

The accepted target is an incremental modular TypeScript SPA:

```text
app -> modules -> shared
```

Presentation API/model, dashboard, sharing and editor code already have a
module boundary. Other active areas still include legacy top-level
`pages/components/contexts/hooks/services/utils` ownership and migrate
incrementally; do not copy those legacy placements into new work.

Live behavior is snapshot-first: HTTP commands are definitive, clients fetch a
role-scoped snapshot, then consume SSE from `last_event_id`. The live runtime
is intentionally separate from ordinary REST server-state caching.

Read:

- `../../docs/status/current.md` for current project state;
- `../../docs/frontend-status.md` for remaining frontend debt;
- `../../docs/frontend-architecture.md` for technical rules;
- `../../docs/frontend-professionalization.md` for UX/design rules;
- `../../docs/decisions/0003-modular-react-frontend.md` for rationale.

## Development

```sh
npm ci
npm run api:types:check
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

`npm run typecheck` checks TS/TSX only; remaining JSX is not magically type
safe because the command is green.

Playwright starts/reuses Vite on port 4173 and expects the Go API on port 8080.
If managed Chromium is unavailable, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chrome executable.

## API and auth

`VITE_API_BASE_URL` and `VITE_LIVE_API_BASE_URL` default to same-origin
`/api/v1`. `VITE_GOOGLE_CLIENT_ID` is a public build value and must match
backend `GOOGLE_CLIENT_ID`.

Authentication uses server-side opaque sessions, HttpOnly cookies and CSRF; the
active application does not use Django JWT access/refresh tokens.

## Production image

The Docker image builds the Vite artifact with Node 22 and serves it through
Nginx on port 8080 with SPA fallback, security/cache headers, same-origin API
proxying and unbuffered SSE. See
`../../docs/deployment-runbook.md`.
