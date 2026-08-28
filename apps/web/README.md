# ProSlides web

React/Vite client for the new Go API.

## Current state

The existing UI is retained while authentication, dashboard, editor, reports,
and the live runtime use the Go API. Live delivery uses typed HTTP commands,
role-scoped snapshots, manager-only paginated rosters, and SSE recovery from
`last_event_id`. No live runtime route opens the historical WebSocket client.

This is not yet a fully TypeScript or modular frontend. As audited on
2026-08-28, the source has 54 JSX, 15 JS, 7 TS, and no TSX files; the current
`typecheck` covers TS only and therefore excludes most UI. Active routing still
coexists with unreachable legacy runtime, some production modules import
mock-era view models, and styling has not converged on one semantic token/RTL
system. Do not copy those patterns into new work.

The accepted migration is incremental—keep React 19 and Vite, preserve the
working Go HTTP/SSE behavior, and move features toward `app -> modules ->
shared`. Read [`docs/frontend-architecture.md`](../../docs/frontend-architecture.md),
[`docs/frontend-professionalization.md`](../../docs/frontend-professionalization.md),
and [ADR 0003](../../docs/decisions/0003-modular-react-frontend.md) before a
frontend change. New or substantially changed feature boundaries should be
TS/TSX and must expand lint/typecheck coverage with them.

## Development

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Passing `npm run typecheck` currently proves the typed seams, not all JSX. The
F1-F5 migration expands this boundary rather than converting the repository in
one mechanical rewrite.

Playwright uses its managed Chromium by default. When browser-binary downloads
are unavailable but Chrome is installed locally, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the Chrome executable before running
`npm run test:e2e`. The smoke suite starts or reuses Vite on port 4173 and
expects the Go API stack on port 8080.

If browser tests receive API proxy 500s while `/readyz` is healthy, inspect
`docker compose ps` and Web logs for a stale image/startup DNS state. Rebuild and
recreate API and Web as documented in `docs/local-development.md`; never remove
volumes to solve image drift.

`VITE_API_BASE_URL` and `VITE_LIVE_API_BASE_URL` configure the Go API. Both
default to same-origin `/api/v1`; the Vite development server proxies it to the
local Go API. The supported production reference is also same-origin; a custom
cross-origin deployment requires separately reviewed cookie, CSRF, and CORS
behavior. `VITE_GOOGLE_CLIENT_ID` enables
the existing Google UI and must exactly match the backend `GOOGLE_CLIENT_ID`.
The Go endpoint verifies the signature, JWKS key, issuer, audience, expiry, and
verified-email claim before issuing the normal session/CSRF cookies.

The original login/register/recovery presentation, animations, responsive
behavior, OTP states, and validation UX are intentionally preserved. The
integration no longer stores Django JWT access/refresh tokens in the browser;
authentication is cookie-based.

The presenter connection moves a new draft session idempotently into the lobby
before displaying its join code. Participant retry/reconnect preserves one
join credential, and final/leaderboard views keep only the participant's own
row plus the aggregate count. Presenter roster and final score pages remain
bounded and load additional rows explicitly.

## Production image

`Dockerfile` builds the Vite artifact with Node 22 and serves it from Nginx on
port 8080. The image provides SPA fallback, bounded cache rules, security
headers, same-origin API proxying, and an unbuffered long-lived SSE route.
Build-time `VITE_GOOGLE_CLIENT_ID` must match the API runtime value. See
[`docs/deployment-runbook.md`](../../docs/deployment-runbook.md).
