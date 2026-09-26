#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: DATABASE_URL=... $0 /absolute/or/relative/path.dump" >&2
  exit 64
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

client_image="${POSTGRES_CLIENT_IMAGE:-postgres:16.15-alpine}"
output="$1"
output_dir="$(dirname "$output")"
output_name="$(basename "$output")"

mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"
tmp_name=".${output_name}.tmp.$$"
tmp_path="$output_dir/$tmp_name"
final_path="$output_dir/$output_name"

if [[ -e "$final_path" ]]; then
  echo "refusing to overwrite existing backup: $final_path" >&2
  exit 65
fi

umask 077
cleanup() {
  rm -f "$tmp_path"
}
trap cleanup EXIT

docker run --rm \
  --add-host host.docker.internal:host-gateway \
  --user "$(id -u):$(id -g)" \
  -e DATABASE_URL \
  -e BACKUP_NAME="$tmp_name" \
  -v "$output_dir:/backup" \
  "$client_image" \
  sh -euc '
    pg_dump \
      --dbname="$DATABASE_URL" \
      --format=custom \
      --compress=6 \
      --no-owner \
      --no-acl \
      --file="/backup/$BACKUP_NAME"
    pg_restore --list "/backup/$BACKUP_NAME" >/dev/null
  '

mv "$tmp_path" "$final_path"
trap - EXIT
echo "verified PostgreSQL backup created: $final_path"
