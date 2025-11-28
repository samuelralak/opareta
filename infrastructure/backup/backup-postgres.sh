#!/bin/bash
#
# PostgreSQL Backup Script
# ========================
# Creates compressed backups of both Argus and Hermes PostgreSQL databases.
#
# Usage:
#   ./backup-postgres.sh
#   ./backup-postgres.sh argus    # Backup only Argus
#   ./backup-postgres.sh hermes   # Backup only Hermes
#
# Environment variables (or .env file):
#   - ARGUS_DB_HOST (default: localhost)
#   - ARGUS_DB_PORT (default: 5432)
#   - ARGUS_DB_USER (default: argus)
#   - ARGUS_DB_PASSWORD
#   - ARGUS_DB_NAME (default: argus_db)
#   - HERMES_DB_HOST (default: localhost)
#   - HERMES_DB_PORT (default: 5433)
#   - HERMES_DB_USER (default: hermes)
#   - HERMES_DB_PASSWORD
#   - HERMES_DB_NAME (default: hermes_db)
#   - BACKUP_DIR (default: /var/backups/opareta)
#   - BACKUP_RETENTION_DAYS (default: 7)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[backup-postgres]"

# Load environment from .env if exists
if [[ -f "${SCRIPT_DIR}/../.env" ]]; then
    set -a
    source "${SCRIPT_DIR}/../.env"
    set +a
fi

# Configuration with defaults
BACKUP_DIR="${BACKUP_DIR:-/var/backups/opareta}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Argus database config
ARGUS_DB_HOST="${ARGUS_DB_HOST:-localhost}"
ARGUS_DB_PORT="${ARGUS_DB_PORT:-5432}"
ARGUS_DB_USER="${ARGUS_DB_USER:-argus}"
ARGUS_DB_PASSWORD="${ARGUS_DB_PASSWORD:-argus_secret}"
ARGUS_DB_NAME="${ARGUS_DB_NAME:-argus_db}"

# Hermes database config
HERMES_DB_HOST="${HERMES_DB_HOST:-localhost}"
HERMES_DB_PORT="${HERMES_DB_PORT:-5433}"
HERMES_DB_USER="${HERMES_DB_USER:-hermes}"
HERMES_DB_PASSWORD="${HERMES_DB_PASSWORD:-hermes_secret}"
HERMES_DB_NAME="${HERMES_DB_NAME:-hermes_db}"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_PREFIX} $*"; }
error() { echo "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_PREFIX} ERROR: $*" >&2; }

setup_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
        chmod 700 "$BACKUP_DIR"
    fi
}

backup_database() {
    local db_name="$1"
    local db_host="$2"
    local db_port="$3"
    local db_user="$4"
    local db_password="$5"
    local db_database="$6"

    local backup_file="${BACKUP_DIR}/${db_name}_${TIMESTAMP}.sql.gz"

    log "Starting backup of ${db_name}..."

    # Use PGPASSWORD for non-interactive authentication
    export PGPASSWORD="$db_password"

    if pg_dump \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_database" \
        --format=plain \
        --no-owner \
        --no-privileges \
        | gzip > "$backup_file"; then

        local size=$(du -h "$backup_file" | cut -f1)
        log "Backup of ${db_name} completed: ${backup_file} (${size})"
        echo "$backup_file"
        return 0
    else
        error "Backup of ${db_name} failed!"
        rm -f "$backup_file"
        return 1
    fi

    unset PGPASSWORD
}

cleanup_old_backups() {
    log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."

    local count=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} | wc -l)

    if [[ $count -gt 0 ]]; then
        find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete
        log "Deleted ${count} old backup(s)"
    else
        log "No old backups to delete"
    fi
}

backup_argus() {
    backup_database "argus" "$ARGUS_DB_HOST" "$ARGUS_DB_PORT" "$ARGUS_DB_USER" "$ARGUS_DB_PASSWORD" "$ARGUS_DB_NAME"
}

backup_hermes() {
    backup_database "hermes" "$HERMES_DB_HOST" "$HERMES_DB_PORT" "$HERMES_DB_USER" "$HERMES_DB_PASSWORD" "$HERMES_DB_NAME"
}

main() {
    local target="${1:-all}"
    local success=true

    log "=========================================="
    log "  Opareta PostgreSQL Backup"
    log "=========================================="

    setup_backup_dir

    case "$target" in
        argus)
            backup_argus || success=false
            ;;
        hermes)
            backup_hermes || success=false
            ;;
        all)
            backup_argus || success=false
            backup_hermes || success=false
            ;;
        *)
            error "Unknown target: $target"
            error "Usage: $0 [argus|hermes|all]"
            exit 1
            ;;
    esac

    cleanup_old_backups

    if $success; then
        log "=========================================="
        log "  Backup completed successfully!"
        log "=========================================="
        exit 0
    else
        error "=========================================="
        error "  Backup completed with errors!"
        error "=========================================="
        exit 1
    fi
}

main "$@"
