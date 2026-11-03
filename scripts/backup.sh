#!/usr/bin/env bash
# SIGNAL database backup — consistent, compressed, timestamped.
# Runs on the HOST (not inside a container). Intended for the docker-compose.prod.yml stack,
# works against the dev stack too when invoked with --env-file/-f overridden.
#
# Usage:    ./scripts/backup.sh                # uses .env.prod by default
#           ./scripts/backup.sh /path/to/dir   # custom backup directory
# Suggested cron (daily 03:30, keep a rolling local window):
#   30 3 * * * /opt/signal/scripts/backup.sh >> /opt/signal/backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

BACKUP_DIR="${1:-./backups}"
mkdir -p "${BACKUP_DIR}"

# Credentials come from the same env file the stack uses — no second source of truth.
DB_USER="$(grep -E '^DB_USER=' "${ENV_FILE}" | cut -d= -f2- || echo signal)"

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/signal-${STAMP}.sql.gz"

# -T (single transaction, consistent snapshot) is safe even with the app running.
${COMPOSE} exec -T postgres pg_dump -U "${DB_USER:-signal}" --single-transaction signal | gzip > "${TARGET}"

echo "backup OK: ${TARGET} ($(du -h "${TARGET}" | cut -f1))"

# Retention: keep the 14 most recent files; delete older ones.
ls -1t "${BACKUP_DIR}"/signal-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
echo "retention: $(ls -1 "${BACKUP_DIR}"/signal-*.sql.gz 2>/dev/null | wc -l) backup(s) kept"
