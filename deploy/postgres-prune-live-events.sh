#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

retention_days="${LIVE_EVENT_RETENTION_DAYS:-30}"
batch_size="${LIVE_EVENT_RETENTION_BATCH_SIZE:-5000}"
dry_run="${LIVE_EVENT_RETENTION_DRY_RUN:-1}"
confirmation="${LIVE_EVENT_RETENTION_CONFIRMATION:-}"
client_image="${POSTGRES_CLIENT_IMAGE:-postgres:16.15-alpine}"

if [[ ! "$retention_days" =~ ^[1-9][0-9]*$ ]]; then
  echo "LIVE_EVENT_RETENTION_DAYS must be a positive integer" >&2
  exit 64
fi
if [[ ! "$batch_size" =~ ^[1-9][0-9]*$ ]]; then
  echo "LIVE_EVENT_RETENTION_BATCH_SIZE must be a positive integer" >&2
  exit 64
fi
if [[ "$dry_run" != "0" && "$dry_run" != "1" ]]; then
  echo "LIVE_EVENT_RETENTION_DRY_RUN must be 0 or 1" >&2
  exit 64
fi
if [[ "$dry_run" == "0" && "$confirmation" != "PRUNE_ENDED_LIVE_EVENTS" ]]; then
  echo "refusing destructive retention run without LIVE_EVENT_RETENTION_CONFIRMATION=PRUNE_ENDED_LIVE_EVENTS" >&2
  exit 65
fi

network_args=()
if [[ -n "${POSTGRES_CLIENT_NETWORK:-}" ]]; then
  network_args+=(--network "$POSTGRES_CLIENT_NETWORK")
fi

psql_client() {
  docker run --rm \
    "${network_args[@]}" \
    --add-host host.docker.internal:host-gateway \
    -e DATABASE_URL \
    "$client_image" \
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

echo "live-event retention policy: ended Sessions older than ${retention_days} day(s)"
psql_client -At \
  -c "SELECT json_build_object(
        'eligible_sessions', count(DISTINCT ls.id),
        'eligible_events', count(le.event_id),
        'oldest_event', min(le.occurred_at)
      )
      FROM live_sessions ls
      LEFT JOIN live_events le ON le.session_id = ls.id
      WHERE ls.state = 'ended'
        AND ls.ended_at IS NOT NULL
        AND ls.ended_at < clock_timestamp() - make_interval(days => $retention_days);"

if [[ "$dry_run" == "1" ]]; then
  echo "dry-run only; no live events were deleted"
  exit 0
fi

total_deleted=0
while true; do
  deleted="$(
    psql_client -At <<SQL
WITH doomed AS (
    SELECT le.event_id
    FROM live_sessions ls
    JOIN live_events le ON le.session_id = ls.id
    WHERE ls.state = 'ended'
      AND ls.ended_at IS NOT NULL
      AND ls.ended_at < clock_timestamp() - make_interval(days => $retention_days)
    ORDER BY ls.ended_at, le.event_id
    LIMIT $batch_size
    FOR UPDATE OF le SKIP LOCKED
), deleted AS (
    DELETE FROM live_events le
    USING doomed
    WHERE le.event_id = doomed.event_id
    RETURNING le.event_id
)
SELECT count(*) FROM deleted;
SQL
  )"

  if [[ ! "$deleted" =~ ^[0-9]+$ ]]; then
    echo "unexpected deleted-row count: $deleted" >&2
    exit 70
  fi
  total_deleted=$((total_deleted + deleted))
  if (( deleted < batch_size )); then
    break
  fi
done

remaining="$(
  psql_client -At \
    -c "SELECT count(*)
        FROM live_events le
        JOIN live_sessions ls ON ls.id = le.session_id
        WHERE ls.state = 'ended'
          AND ls.ended_at IS NOT NULL
          AND ls.ended_at < clock_timestamp() - make_interval(days => $retention_days);"
)"
if [[ "$remaining" != "0" ]]; then
  echo "retention run left $remaining eligible event(s); retry after concurrent maintenance completes" >&2
  exit 75
fi

echo "deleted $total_deleted live event(s) from ended Sessions beyond retention"
