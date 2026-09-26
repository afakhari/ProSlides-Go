# Configuration reference

Configuration is read from environment variables. Copy the example files for
local development, but inject production values through the deployment
platform's secret/config store. Never commit passwords, peppers, database URLs,
cookies, participant credentials, or provider tokens.

## API variables

| Variable | Default/example | Purpose and constraints |
|---|---|---|
| `APP_ENV` | `development` | Set to `production` to emit Secure cookies. |
| `HTTP_ADDR` | `:8080` | Go HTTP listen address. |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARN`/`WARNING`, or `ERROR`. |
| `DATABASE_URL` | required | PostgreSQL connection URL; required in every environment. Production requires `sslmode=require`, `verify-ca`, or `verify-full`. |
| `REDIS_URL` | required | Redis connection URL; required for readiness and distributed identity limits. Production requires `rediss://`. |
| `DEPENDENCY_CHECK_TIMEOUT` | `2s` | Positive Go duration bounding each readiness ping. |
| `MIGRATION_TIMEOUT` | `2m` | Positive duration bounding advisory-lock wait and startup migrations. |
| `LIVE_REQUEST_TIMEOUT` | `10s` | Positive deadline for non-streaming live requests; SSE is exempt. |
| `DATABASE_POOL_MAX_CONNS` | `50` | Maximum PostgreSQL connections per API replica; size against the database connection budget. |
| `DATABASE_POOL_MIN_CONNS` | `5` | Warm connections per replica; non-negative and no greater than max. |
| `DATABASE_CONN_MAX_LIFETIME` | `30m` | Maximum PostgreSQL connection lifetime. |
| `DATABASE_CONN_MAX_IDLE_TIME` | `5m` | Maximum idle time before a pooled connection is retired. |
| `SESSION_TTL` | `168h` | Positive Go duration for account sessions. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false` | When true, registration requires verified email before login. |
| `EMAIL_VERIFICATION_TTL` | `10m` | Positive OTP lifetime. |
| `EMAIL_VERIFICATION_RESEND_DELAY` | `60s` | Positive minimum interval between verification messages. |
| `EMAIL_VERIFICATION_MAX_ATTEMPTS` | `5` | Positive maximum checks for one verification challenge. |
| `EMAIL_VERIFICATION_PEPPER` | empty | Secret server-side OTP pepper; at least 32 characters when verification is required. |
| `PASSWORD_RESET_TTL` | `15m` | Positive reset-token lifetime. |
| `PUBLIC_WEB_URL` | local example `http://localhost:5173` | Browser origin used to build reset links. In production it must be an HTTPS origin with no path, query, credentials, or fragment. |
| `SMTP_HOST` | empty | SMTP server. Must be configured together with `SMTP_FROM_ADDRESS`. |
| `SMTP_PORT` | `25` | Positive SMTP port. |
| `SMTP_USERNAME` | empty | Optional SMTP authentication username. |
| `SMTP_PASSWORD` | empty | Optional SMTP authentication secret. |
| `SMTP_FROM_ADDRESS` | empty | Sender address; paired with `SMTP_HOST`. |
| `SMTP_FROM_NAME` | `ProSlides` | Human-readable sender name. |
| `SMTP_USE_TLS` | `false` | STARTTLS mode; mutually exclusive with `SMTP_USE_SSL`. |
| `SMTP_USE_SSL` | `false` | Implicit TLS mode; mutually exclusive with `SMTP_USE_TLS`. |
| `GOOGLE_CLIENT_ID` | empty | Enables Google login verification when set. Must match the web client ID. |
| `GOOGLE_JWKS_URL` | Google certificates URL | Override only for a controlled provider/test endpoint. When Google login is enabled in production, this URL must use HTTPS. |
| `TRUSTED_PROXY_CIDRS` | empty | Comma-separated direct proxy networks allowed to supply forwarded client IPs. Production startup requires at least one trusted proxy range for the supported proxy topology. |

`AUTH_REQUIRE_EMAIL_VERIFICATION=true` requires configured SMTP and a strong
`EMAIL_VERIFICATION_PEPPER`. An SMTP username must be used over TLS or SSL; the
mailer rejects authenticated plaintext delivery. `SMTP_USE_TLS` and
`SMTP_USE_SSL` cannot both be true.

When SMTP is intentionally absent, ordinary local registration/login can run
with email verification disabled, but password-reset delivery returns a safe
service-unavailable response. Password reset also requires `PUBLIC_WEB_URL` so
the API can construct the link. When `GOOGLE_CLIENT_ID` is absent, Google login
is disabled with a safe service-unavailable response. Provider secrets are
never returned to the browser or health endpoints.

Keep `TRUSTED_PROXY_CIDRS` empty when clients reach Go directly in local/test
topologies. The supported production topology always places the web proxy in
front of Go, so production startup rejects an empty trusted-proxy set. Use the
proxy's exact network ranges. The API ignores forwarded addresses from untrusted
peers and selects the right-most untrusted address from a trusted chain so a
client-supplied prefix cannot bypass identity rate limits.

Production startup also rejects unencrypted PostgreSQL/Redis URLs, a non-HTTPS
or non-origin `PUBLIC_WEB_URL`, and non-HTTPS `GOOGLE_JWKS_URL` when Google
login is enabled. These checks live in the API process as well as the deployment
examples so an alternate launcher cannot silently bypass the reference
configuration boundary.

## Web variables

| Variable | Local value | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Identity, dashboard, editor, and report API base. |
| `VITE_LIVE_API_BASE_URL` | `/api/v1` | Live HTTP/SSE API base. |
| `VITE_GOOGLE_CLIENT_ID` | provider client ID | Enables the existing Google UI; must exactly equal API `GOOGLE_CLIENT_ID`. |

The supported production reference uses same-origin `/api/v1`. A custom
cross-origin topology requires separately reviewed cookie, CSRF, and CORS
behavior. Vite variables are public build inputs and must never contain a
client secret.

## Compose and release variables

| Variable | Default | Purpose |
|---|---|---|
| `API_PORT` | `8080` | Loopback host port for direct local API diagnostics. |
| `WEB_BIND_ADDR` | `0.0.0.0` | Local web bind address; permits trusted LAN/hotspot testing. Set `127.0.0.1` to restrict access to the computer. |
| `WEB_PORT` | `5173` | Host port for the complete local application. |
| `POSTGRES_DB` | `proslides` | Local Compose database name. |
| `POSTGRES_USER` | `proslides` | Local Compose database user. |
| `POSTGRES_PASSWORD` | `proslides` | Local-only password; if changed, update `DATABASE_URL` too. |
| `POSTGRES_PORT` | `5432` | Loopback PostgreSQL port for host-mode API development. |
| `REDIS_PORT` | `6379` | Loopback Redis port for host-mode API development. |
| `API_IMAGE` | required in production | Immutable API registry tag/digest. |
| `WEB_IMAGE` | required in production | Immutable web tag/digest built with the matching public Google client ID. |
| `APP_HTTP_PORT` | `8080` | Production-reference loopback port consumed by TLS ingress. |
| `APP_SUBNET` | `172.30.0.0/24` | Isolated reference subnet and trusted web-proxy range. |

The repository-root Compose interpolates these values and passes all SMTP
credentials through to the API. Only the web ingress is LAN-accessible by
default; the API, PostgreSQL, and Redis host ports remain loopback-bound. The
PostgreSQL/Redis defaults are local only and must not be reused as production
credentials.

## Dependency and failure behavior

- `GET /healthz` is process-only and does not prove dependencies.
- `GET /readyz` returns 200 only when both PostgreSQL and Redis respond within
  `DEPENDENCY_CHECK_TIMEOUT`; responses expose only safe status names.
- API startup waits until pgx has established at least
  `DATABASE_POOL_MIN_CONNS` connections before serving, so readiness never
  advertises an unwarmed configured minimum or opens duplicate warm-up
  connections. Size `DEPENDENCY_CHECK_TIMEOUT` to cover those handshakes.
- PostgreSQL is authoritative for sessions, content, answers, scores, commands,
  and replay events.
- Redis identity and live limits fail open on Redis errors so Redis never
  becomes the durable command ledger; readiness still reports the outage.
- `GET /metrics` is available on the private API ingress in Prometheus text
  format with bounded method/route/status labels plus in-flight, heap,
  goroutine, PostgreSQL pool/query duration and outcome, live-answer, SSE/broker,
  slow-subscriber, database-failure, and event-lag metrics. Do not expose it
  through the public web ingress.
- Production TLS terminates at the trusted ingress. The API emits Secure cookies
  when `APP_ENV=production`; preserve forwarded-origin semantics at the proxy.

## Production checklist

1. Generate unique database/Redis credentials and a random verification pepper;
   store them only in the secret manager.
2. Configure verified SMTP sender credentials and one TLS mode, then exercise
   verification, resend, forgot-password, expiry, and one-time-use paths.
3. Create the Google OAuth web client for the exact production origin and set
   the identical client ID in API and web builds. No client secret is required
   by this ID-token flow.
4. Set `PUBLIC_WEB_URL`, use the documented same-origin ingress, and keep
   `APP_ENV=production`; confirm cookie, CSRF, and reset-link behavior through
   the public HTTPS hostname.
5. Confirm `/healthz` and `/readyz`, migration startup, backups, restore, and
   secret rotation in a non-production environment before cutover.

Canonical local examples live in
[`apps/api/.env.example`](../apps/api/.env.example) and
[`apps/web/.env.example`](../apps/web/.env.example). Host-mode API values are in
[`apps/api/.env.local.example`](../apps/api/.env.local.example); production keys
are inventoried in [`deploy/.env.production.example`](../deploy/.env.production.example).
