# ProSlides System Overview

This document explains the service topology, data flow, and required
configuration for a correct backend + frontend + Rust setup.

## Components

1) Django API (backend)
- Handles auth, quizzes CRUD, export, password reset, and email verification.
- Base URL example: `https://api.proslides.ir/api`
- Ports: typically `8000` behind Nginx.

2) Rust Facade (WebSocket service)
- Acts as a realtime bridge for quiz sessions.
- Uses Redis for state and talks to Django over HTTP for export + results.
- WebSocket endpoint example: `ws://<host>:8080/ws/{session_id}/{role}`

3) Redis
- Used by Rust facade for session state and scoring.
- Default URL in Rust: `redis://127.0.0.1/` (local).

4) Frontend (Vite / React)
- Consumes Django API and connects to Rust WS for realtime quiz.
- Base URL configured via `VITE_API_BASE_URL`.

## Data Flow (High Level)

1) Manager opens a quiz in the frontend.
2) Frontend hits Django:
   - `GET /api/quizzes/{id}/export/` (manager UI)
3) Rust facade also calls Django to fetch quiz data:
   - `GET /api/quizzes/{id}/export/` with `X-Export-Token`
4) Players connect to Rust WS:
   - `ws://<host>:8080/ws/{session_id}/player`
5) Rust sends leaderboard + results back to Django:
   - `POST /api/quizzes/{id}/slides/{slide_id}/question/leaderboard/`
   - `POST /api/quizzes/{id}/slides/{slide_id}/question/results/`

## Required Environment Variables

### Django (.env)
```
DEBUG=False
SECRET_KEY=change-me
ALLOWED_HOSTS=proslides.ir,api.proslides.ir
DJANGO_SETTINGS_MODULE=backend.srvs.office.office.settings.prod
EXPORT_SERVICE_TOKEN=change-me-export-token
GOOGLE_CLIENT_ID=your-google-client-id
```

Optional but recommended:
```
GOOGLE_OAUTH_CERTS_URL=https://www.googleapis.com/oauth2/v3/certs
CORS_ALLOWED_ORIGINS=https://proslides.ir,https://www.proslides.ir
CSRF_TRUSTED_ORIGINS=https://proslides.ir,https://www.proslides.ir
LOG_LEVEL=INFO
LOG_DIR=/var/log/proslides
LOG_REQUEST_THRESHOLD_MS=500
```

### Rust Facade (process environment)
```
EXPORT_SERVICE_TOKEN=change-me-export-token
DJANGO_API_BASE_URL=https://api.proslides.ir/api
```

### Frontend (frontend/.env)
```
VITE_API_BASE_URL=https://api.proslides.ir/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Authentication + Email

Auth endpoints used by the frontend:
- `POST /api/auth/register/`
- `POST /api/auth/verify/`
- `POST /api/auth/token/`
- `POST /api/auth/google/`
- `POST /api/auth/password/reset/`
- `POST /api/auth/logout/`

Email verification depends on SMTP config in `.env`. If email verification is
required, users are created as inactive and must verify via the 6-digit code.

## Google OAuth Notes

Backend requires outbound access to:
```
https://www.googleapis.com/oauth2/v3/certs
```
If outbound access is blocked, Google sign-in will fail with a certificate
fetch error. Solve this by:
- Allowing outbound access from the server, or
- Proxying the certs endpoint and pointing `GOOGLE_OAUTH_CERTS_URL` to it.

Frontend origin must be allowed in Google Cloud OAuth Client:
- `http://localhost:5173` (local)
- `https://proslides.ir` (prod)

### Offline-verify mode (current fallback)
When server-to-server access to Google certs is blocked, the backend uses a
minimal claim-only validation strategy:
- no signature verification
- checks `iss`, `aud`, `exp`, `email`, `email_verified`

This keeps development unblocked while preserving basic safety checks. The
code is structured so full verification can be restored later with minimal
changes.

## CORS / CSRF

If the frontend is local and the backend is remote, the backend must allow:
```
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```
Restart Django after changing env.

## Quick Health Checks

1) Django:
```
GET /swagger
GET /api/quizzes/{id}/export/
```

2) Rust facade:
```
ws://<host>:8080/ws/{session_id}/manager
```

3) Service token auth (from any machine):
```
curl -H "X-Export-Token: <token>" https://api.proslides.ir/api/quizzes/123/export/
```

## Logging (Dev + Prod)

- Logs are written to `LOG_DIR` (default: `backend/srvs/office/logs`).
- `app.log` stores general logs; `errors.log` stores error-level logs.
- Every request gets a `request_id` and the response includes `X-Request-ID`.
- Slow requests are logged when they exceed `LOG_REQUEST_THRESHOLD_MS` (default 500ms).
