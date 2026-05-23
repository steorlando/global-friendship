#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/selfhosted-db-query.sh <sql-file>" >&2
  exit 2
fi

sql_file="$1"
if [[ ! -f "$sql_file" ]]; then
  echo "SQL file not found: $sql_file" >&2
  exit 2
fi

env_file="${GLOBAL_FRIENDSHIP_DB_ENV:-/Users/stefanolaptop/Documents/codex_new/migrazione-supabase/.env.global-friendship-event.local}"
if [[ ! -f "$env_file" ]]; then
  echo "Database env file not found: $env_file" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

if [[ -z "${TARGET_SSH_HOST:-}" || -z "${TARGET_SSH_USER:-}" || -z "${TARGET_DB_CONTAINER:-}" ]]; then
  echo "TARGET_SSH_HOST, TARGET_SSH_USER, and TARGET_DB_CONTAINER are required." >&2
  exit 2
fi

ssh -p "${TARGET_SSH_PORT:-22}" "${TARGET_SSH_USER}@${TARGET_SSH_HOST}" \
  "docker exec -i ${TARGET_DB_CONTAINER} psql --single-transaction --set ON_ERROR_STOP=1 -U ${TARGET_DB_USER:-postgres} -d ${TARGET_DB_NAME:-postgres}" \
  < "$sql_file"
