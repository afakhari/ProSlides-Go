# Operations, backup, and rollback runbook

## Release record

For every deployment record the commit SHA, immutable API/web image digests,
configuration version, migration list, operator, start/end time, topology, and
verification result. Never record secret values.

## PostgreSQL backup

Use the managed service's encrypted snapshot and point-in-time recovery when
available. Before every schema/application release, also create a portable
custom-format backup from a trusted Linux/WSL operator host. The checked-in
command runs the PostgreSQL 16 client in an isolated container, writes through a
temporary file, validates the archive with `pg_restore --list`, refuses to
overwrite an existing artifact, and only then publishes the final filename:

```bash
export DATABASE_URL='postgres://...'
export POSTGRES_CLIENT_IMAGE='postgres:16.15-alpine'
stamp="$(date -u +%Y%m%d-%H%M%S)"
bash deploy/postgres-backup.sh "proslides-$stamp.dump"
```

The database URL is passed as container environment rather than a command-line
argument. Encrypt the finished artifact, store it outside the application host,
apply the approved retention policy, and restrict access. A verified archive is
still not restore proof; the restore path must also be exercised.

## Restore exercise

Never restore over the active production database. Provision an isolated empty
PostgreSQL 16 database, restrict its network, and restore there. The restore
command requires an explicit destructive-operation acknowledgement, rejects both an
exact `DATABASE_URL` match and a differently written URL that resolves to the
same PostgreSQL server/port/database identity, validates the archive before
modifying the target, restores in one transaction with errors fatal, and checks
that the migration ledger is present afterward:

```bash
export DATABASE_URL='postgres://production-source/...'
export RESTORE_DATABASE_URL='postgres://isolated-restore-target/...'
export RESTORE_CONFIRMATION='RESTORE_ISOLATED_DATABASE'
export POSTGRES_CLIENT_IMAGE='postgres:16.15-alpine'
bash deploy/postgres-restore.sh proslides-backup.dump
```

CI performs this backup/restore path against a migrated PostgreSQL 16 source and
a separate temporary database, and compares source/restored migration-ledger
counts. That proves the repository restore mechanism remains executable; it does
not prove a provider snapshot, network path, encryption key, production data
volume, RPO, or RTO.

Start one API instance against the restored database and a non-production
Redis, verify readiness and critical product flows, then record achieved RPO and
RTO. Delete the isolated restore environment only through the approved
destructive-data procedure.

Redis contains readiness/rate-limit state only and is not restored as product
truth. Losing Redis must not lose users, content, answers, scores, or events.

## Live replay-event retention

`live_events` is a reconnect/replay ledger, not the report or scoring source of
truth. Active and non-ended Sessions are never eligible for pruning. The
repository default operational policy retains replay events for **30 days after
a Session ends**; reports, participant responses, immutable score deltas and
frozen Session Items remain in their own durable tables.

Run retention from a trusted operator host/container network. The command is
dry-run by default and reports the eligible Session/event count without deleting
anything:

```bash
export DATABASE_URL='postgres://...'
export POSTGRES_CLIENT_IMAGE='postgres:16.15-alpine'
export LIVE_EVENT_RETENTION_DAYS=30
bash deploy/postgres-prune-live-events.sh
```

After reviewing the dry-run and confirming the backup/incident-retention
requirements for that environment, enable deletion explicitly:

```bash
export LIVE_EVENT_RETENTION_DRY_RUN=0
export LIVE_EVENT_RETENTION_CONFIRMATION=PRUNE_ENDED_LIVE_EVENTS
export LIVE_EVENT_RETENTION_BATCH_SIZE=5000
bash deploy/postgres-prune-live-events.sh
```

Deletion is batched and uses row locking with `SKIP LOCKED`; a concurrent
maintenance run therefore cannot turn one cleanup into an unbounded transaction.
Changing the 30-day window is an operational/compliance decision and must be
recorded with the release/environment. Never shorten it during an unresolved
incident or before preserving required forensic data.

## Production observability gate

The private API `/metrics` endpoint owns bounded application metrics. The
deployment platform/database exporter owns machine and database-host telemetry;
do not add participant/session/request IDs as Prometheus labels merely because a
dashboard looks lonely without them.

Before public production, dashboards and alerts must cover at least:

| Signal | Release/incident expectation |
|---|---|
| readiness | external/private probe alerts on sustained failure |
| HTTP 5xx | sustained non-zero error rate is investigated; release rollback/stop criteria follow the deployment observation window |
| HTTP latency | histogram p95/p99 tracked by route against the SLOs in `capacity-plan.md` |
| live event lag | histogram p95 <= 1s and p99 <= 2s during the tested workload |
| SSE slow-client drops | any sustained increase is investigated with reconnect/event lag |
| broker DB failures | any increase is actionable; PostgreSQL is the replay source of truth |
| PostgreSQL pool | acquired/max headroom, acquire duration, empty/canceled acquires |
| PostgreSQL query latency/errors | bounded operation/outcome histograms/counters plus provider CPU/IO/locks/deadlocks |
| runtime saturation | API CPU/RSS/network/file descriptors from platform telemetry; heap/goroutines from application metrics |
| live answers | accepted/duplicate/conflict/internal outcomes and answer-duration rate |
| event retention | scheduled dry-run count reviewed; destructive pruning records timestamp, window and deleted row count |

Do not expose `/metrics` through the public web ingress. Alerts must reference
bounded labels and the tested infrastructure shape; thresholds derived from the
1k/5k/10k capacity runs supersede provisional defaults when evidence exists.

## Application rollback

1. Stop rollout and preserve logs, metrics, release metadata, and the current
   database state.
2. Confirm the previous API understands every migration already applied.
3. Set `API_IMAGE` and `WEB_IMAGE` to the previous immutable, compatible tags.
4. Run `docker compose ... config --quiet`, deploy, and repeat the public smoke.
5. Keep the failed release artifacts for diagnosis.

Migrations are forward-only. Never delete a migration row or run an improvised
down migration. If the previous binary is not schema-compatible, roll forward
with a reviewed corrective migration/application release. Restore is a disaster
recovery operation, not the normal rollback mechanism.

## Secret rotation

- Rotate database/Redis and SMTP credentials through overlapping credentials
  when the provider supports them; deploy new values before revoking old ones.
- Rotating `EMAIL_VERIFICATION_PEPPER` invalidates outstanding verification
  codes; announce or plan for that effect.
- Changing Google client ID requires rebuilding web and updating API in one
  release.
- After suspected cookie/session compromise, revoke affected PostgreSQL
  sessions in addition to rotating infrastructure secrets.

## Incident checks

| Signal | First checks |
|---|---|
| readiness failure | PostgreSQL/Redis connectivity, TLS, credentials, pool exhaustion |
| migration startup failure | advisory-lock wait, `schema_migrations`, database permissions, timeout |
| login throttles all users | trusted proxy CIDR and forwarded-address chain |
| delayed/missing SSE | both proxy buffering settings, timeouts, event ledger lag, slow-client reconnects |
| password mail unavailable | SMTP TLS mode, sender, credentials, `PUBLIC_WEB_URL` |
| score/report mismatch | stop promotion and run the reconciliation rules in `capacity-plan.md` |

Before public production, connect alerts and dashboards for the bounded metrics
listed in `capacity-plan.md`; until that telemetry gate passes, this repository
must be described as deployable for controlled validation, not production
capacity-certified.
