# Deployment runbook

## Supported reference topology

The repository supplies portable OCI images and a single-host Compose reference:

```text
Internet -> trusted TLS ingress -> web Nginx container -> Go API
                                              Go API -> managed PostgreSQL
                                                     -> managed Redis
```

The web container serves the React SPA, provides route fallback, proxies
same-origin `/api/v1`, and disables buffering for SSE. PostgreSQL and Redis are
external in the production reference so their backup, availability, encryption,
and upgrades can be managed independently.

This runbook makes deployment reproducible; it does not certify the 10k target.
The capacity and observability gates in `capacity-plan.md` still apply before a
public high-load launch.

## Build immutable images

Choose one release identifier, normally the Git commit SHA:

```powershell
$release = git rev-parse HEAD
$registry = 'registry.example.com/proslides'

docker build --pull -t "${registry}/api:${release}" apps/api
docker build --pull --build-arg VITE_API_BASE_URL=/api/v1 --build-arg VITE_LIVE_API_BASE_URL=/api/v1 --build-arg VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID -t "${registry}/web:${release}" apps/web
```

Run Go/web tests before pushing. Push both immutable tags through the approved
registry workflow; never deploy `latest`. `VITE_GOOGLE_CLIENT_ID` is a public
build value and must equal the runtime API `GOOGLE_CLIENT_ID`.

## Provision dependencies

1. Provision PostgreSQL 16 with TLS, backups, point-in-time recovery where
   available, and enough connections for the tested API replica count.
2. Ensure the deployment role can create/use `pgcrypto`; pre-create the
   extension with an administrator if the managed service restricts extensions.
3. Provision Redis 7 with TLS/authentication and network access restricted to
   API instances. Redis is not a backup source for product data.
4. Restrict PostgreSQL and Redis ingress to the application network.
5. Record owner-approved RPO, RTO, retention, and restore-test cadence before
   accepting production traffic.

## Configure secrets

Use `deploy/.env.production.example` only as a key inventory. Prefer the
platform secret store. If a single-host Compose deployment must use a file,
create an ignored `.env.production`, restrict it to the deployment account, and
never print `docker compose config` without `--quiet` because interpolation can
expose secrets.

Required controls:

- `APP_ENV=production` is fixed by the reference and enables Secure cookies.
- `PUBLIC_WEB_URL` is the exact public HTTPS origin.
- `EMAIL_VERIFICATION_PEPPER` is random and at least 32 characters.
- SMTP uses STARTTLS or implicit TLS; authenticated plaintext SMTP is rejected.
- frontend/backend Google client IDs match exactly.
- `APP_SUBNET` must match the isolated Compose network and
  `TRUSTED_PROXY_CIDRS`; do not trust all private networks in production.

Validate without rendering secret values:

```powershell
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml config --quiet
```

## TLS ingress

`deploy/ingress.nginx.example.conf` is a host-level example. Replace the domain
and certificate paths, validate with `nginx -t`, and keep the application port
bound to `127.0.0.1`. The outer proxy must overwrite untrusted
`X-Forwarded-For`, preserve `Host`, set `X-Forwarded-Proto=https`, disable SSE
buffering, and allow hour-long SSE reads. Apply equivalent settings when using
a cloud load balancer.

## First deployment and upgrade

Take and verify a PostgreSQL backup first. On a trusted Linux/WSL operator host
with Docker available:

```bash
export DATABASE_URL='postgres://...'
export POSTGRES_CLIENT_IMAGE='postgres:16.15-alpine'
stamp="$(date -u +%Y%m%d-%H%M%S)"
bash deploy/postgres-backup.sh "proslides-$stamp.dump"
```

Move the verified artifact to approved encrypted storage before applying
migrations. Then deploy:

```powershell
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml pull
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml up -d --wait
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml ps
```

The API applies forward-only migrations before serving. A PostgreSQL advisory
lock serializes simultaneous replica startup, and each migration plus ledger
entry commits in one transaction. `MIGRATION_TIMEOUT` bounds how long a replica
waits. Readiness requires both PostgreSQL and Redis; the web container starts
only after API readiness in the Compose reference.

Verify through the public HTTPS hostname:

```powershell
Invoke-RestMethod https://proslides.example.com/api/v1/version
curl.exe -i https://proslides.example.com/api/v1/auth/me
```

Also verify `/healthz` and `/readyz` on the private API path, SPA deep-link
fallback, register/login/logout, CSRF rejection, one provider delivery, join,
answer, snapshot/SSE recovery, and presenter results. Do not expose API port
8080 publicly.

## Rollout and drain

- Keep the previous API and web image tags available.
- Roll API instances gradually; the server allows 15 seconds for in-flight
  HTTP shutdown and SSE clients recover through snapshot/replay.
- The bundled web Nginx re-resolves the Compose `api` service through Docker
  DNS every 10 seconds, so an API container address change does not require a
  Web restart. A single-API replacement can still return transient 502s during
  the dependency gap; use overlapping healthy API instances at the external
  ingress when zero-downtime command acceptance is required.
- Never mix a web build with a different Google client ID or incompatible API
  contract.
- Do not declare success until readiness, error rate, SSE reconnects, and the
  functional smoke remain healthy for the observation window.

Rollback and data recovery are defined in `operations-runbook.md`.
