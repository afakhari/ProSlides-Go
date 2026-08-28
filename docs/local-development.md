# Local development runbook

## Prerequisites

- Git.
- Docker Desktop or another Docker Engine with Compose v2.
- For hot reload: Go version from `apps/api/go.mod`, Node 22 or newer, and npm.
- PowerShell 5.1 or newer for the repository integration scripts.

Run every command from the repository root unless a section says otherwise.
Real provider secrets belong only in ignored local files or a secret manager.

## Fastest full-stack start

The default Compose stack builds and starts PostgreSQL, Redis, the Go API, and
the production React/Nginx image:

```powershell
docker compose --env-file apps/api/.env.example up --build -d
docker compose ps
Invoke-RestMethod http://localhost:8080/readyz
Invoke-WebRequest -UseBasicParsing http://localhost:5173/web-healthz
```

Open `http://localhost:5173`. The web container listens on all local network
interfaces by default, so a phone connected to the same trusted Wi-Fi or
hotspot can open `http://<computer-ipv4>:5173`. Find that address with
`ipconfig`; allow inbound TCP port `5173` for Private networks in Windows
Firewall if prompted. Requests under `/api/v1` are sent through the same-origin
Nginx proxy to the Go API. The API, PostgreSQL, and Redis remain loopback-only;
direct API access is available at `http://localhost:8080` for diagnostics.

Set `WEB_BIND_ADDR=127.0.0.1` before running Compose when network access is not
wanted. When SMTP-backed reset links are exercised from another device, also
set `PUBLIC_WEB_URL` to the reachable web origin instead of `localhost`.

The example configuration disables external email and Google login. Regular
register/login works, while password reset and Google login return a safe 503
until their provider variables are configured.

Stop containers without deleting data:

```powershell
docker compose down
```

Do not use `down -v`: it permanently deletes the local PostgreSQL and Redis
volumes.

## Hot-reload development

Start dependencies only:

```powershell
docker compose up -d postgres redis
Copy-Item apps/api/.env.local.example apps/api/.env.local
powershell -ExecutionPolicy Bypass -File scripts/run-api-local.ps1
```

The script loads `apps/api/.env.local` into its process before `go run`; the Go
binary intentionally does not auto-load dotenv files. The local example uses
`127.0.0.1` dependency addresses, unlike the Compose-only hostnames in
`apps/api/.env.example`.

In a second terminal:

```powershell
Push-Location apps/web
npm ci
npm run dev
Pop-Location
```

Vite serves the UI on all local network interfaces and proxies `/api/v1` to
`127.0.0.1:8080`, so the same `http://<computer-ipv4>:5173` address works for
hot reload. Override values only in an ignored `apps/web/.env.local`;
browser-prefixed `VITE_*` values are public and must never contain secrets.

## Verification

```powershell
Push-Location apps/api
& 'C:\Program Files\Go\bin\go.exe' test ./...
& 'C:\Program Files\Go\bin\go.exe' vet ./...
Pop-Location

Push-Location apps/web
npm run lint
npm run typecheck
npm run test:unit
npm run build
Pop-Location

powershell -ExecutionPolicy Bypass -File scripts/test-auth-integration.ps1 -SkipComposeStartup
```

The Playwright smoke additionally needs the API stack on port 8080:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
Push-Location apps/web
npm run test:e2e
Pop-Location
```

The Vite test server proxies `/api/v1` to `127.0.0.1:8080`; a healthy API that
exists only inside the Compose network is insufficient. Confirm the published
port with `docker compose ps` and `Invoke-RestMethod
http://localhost:8080/readyz` before diagnosing a UI assertion.

### Refresh stale API/Web images without deleting data

After source or Nginx changes, an already-running container may still use an
older image. Rebuild and recreate only the application services while keeping
the named PostgreSQL/Redis volumes:

```powershell
docker compose --env-file apps/api/.env.example config --quiet
docker compose --env-file apps/api/.env.example up --build -d --force-recreate api web
docker compose ps
Invoke-RestMethod http://localhost:8080/readyz
Invoke-WebRequest -UseBasicParsing http://localhost:5173/web-healthz
```

If Web logs show an old startup-time `api` DNS resolution failure or browser
requests return proxy 500s, use this refresh before rerunning E2E. Do not use
`down -v`, `docker volume rm`, a database reset, or a Redis purge to repair
container/image drift.

## Common failures

| Symptom | Check |
|---|---|
| API exits with missing URLs | use `run-api-local.ps1`; copying `.env` alone does not load it |
| host cannot resolve `postgres` | use `.env.local.example` for host execution |
| `/readyz` is 503 | inspect `docker compose ps` and safe API logs; both PostgreSQL and Redis are required |
| reset/Google returns 503 | configure the matching provider variables; this is expected with local defaults |
| port already allocated | set `API_PORT`, `WEB_PORT`, `POSTGRES_PORT`, or `REDIS_PORT`; keep host-mode URLs consistent |
| phone cannot open the site | confirm both devices share a network, use the computer's active IPv4 address rather than `localhost`, and allow inbound TCP `5173` on Private networks |
| SSE updates are delayed behind another proxy | disable response buffering and use a read timeout longer than the session |
| E2E gets API proxy 500 while API is ready | inspect `docker compose ps`/Web logs, then rebuild and force-recreate only `api web`; preserve volumes |
