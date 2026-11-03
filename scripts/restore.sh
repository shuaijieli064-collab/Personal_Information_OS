#!/usr/bin/env bash
# SIGNAL database restore — REPLACES everything currently in the 'signal' database.
# Runs on the HOST. Stop nothing: the restore runs in a single transaction and the
# backend will just see the data swap; the safest sequence is still
#   down → restore → up
#
# Usage: ./scripts/restore.sh backups/signal-20261103-033000.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

FILE="${1:?usage: ./scripts/restore.sh backups/signal-YYYYMMDD-HHMMSS.sql.gz}"
[ -f "${FILE}" ] || { echo "not a file: ${FILE}" >&2; exit 1; }

DB_USER="$(grep -E '^DB_USER=' "${ENV_FILE}" | cut -d= -f2- || echo signal)"

read -r -p "This REPLACES the live database with ${FILE}. Type 'RESTORE' to continue: " answer
[ "${answer}" = "RESTORE" ] || { echo "aborted"; exit 1; }

${COMPOSE} exec -T postgres psql -U "${DB_USER:-signal}" -d signal \
  < <(gunzip -c "${FILE}")

echo "restore OK: ${FILE}"
