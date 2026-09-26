#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: RESTORE_DATABASE_URL=... RESTORE_CONFIRMATION=RESTORE_ISOLATED_DATABASE $0 backup.dump" >&2
  exit 64
fi

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

if [[ "${RESTORE_CONFIRMATION:-}" != "RESTORE_ISOLATED_DATABASE" ]]; then
  echo "refusing destructive restore without RESTORE_CONFIRMATION=RESTORE_ISOLATED_DATABASE" >&2
  exit 65
fi

if [[ -n "${DATABASE_URL:-}" && "$DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then
  echo "refusing to restore to DATABASE_URL; use a separate isolated target database" >&2
  exit 66
fi

backup="$1"
if [[ ! -f "$backup" ]]; then
  echo "backup not found: $backup" >&2
  exit 67
fi

client_image="${POSTGRES_CLIENT_IMAGE:-postgres:16.15-alpine}"
backup_dir="$(cd "$(dirname "$backup")" && pwd)"
backup_name="$(basename "$backup")"

docker run --rm \
  --add-host host.docker.internal:host-gateway \
  --user "$(id -u):$(id -g)" \
  -e RESTORE_DATABASE_URL \
  -e BACKUP_NAME="$backup_name" \
  -v "$backup_dir:/backup:ro" \
  "$client_image" \
  sh -euc '
    pg_restore --list "/backup/$BACKUP_NAME" >/dev/null
    pg_restore \
      --dbname="$RESTORE_DATABASE_URL" \
      --clean \
      --if-exists \
      --no-owner \
      --no-acl \
      --exit-on-error \
      --single-transaction \
      "/backup/$BACKUP_NAME"

    migration_count="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM schema_migrations")"
    case "$migration_count" in
      ""|0|*[!0-9]*)
        echo "restore verification failed: schema_migrations is empty or invalid" >&2
        exit 1
        ;;
    esac
  '

echo "PostgreSQL restore completed and migration ledger verified"
