#!/bin/bash
#
# PostgreSQL Restore Script
# =========================
# Restores a PostgreSQL database from a backup file.
#
# Usage:
#   ./restore-postgres.sh <backup_file> <database>
#
# Examples:
#   ./restore-postgres.sh /var/backups/opareta/argus_20231201_120000.sql.gz argus
#   ./restore-postgres.sh /var/backups/opareta/hermes_20231201_120000.sql.gz hermes
#
# Environment variables (or .env file):
#   - ARGUS_DB_HOST, ARGUS_DB_PORT, ARGUS_DB_USER, ARGUS_DB_PASSWORD, ARGUS_DB_NAME
#   - HERMES_DB_HOST, HERMES_DB_PORT, HERMES_DB_USER, HERMES_DB_PASSWORD, HERMES_DB_NAME
#
# WARNING: This will DROP and recreate the database!
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[restore-postgres]"

# Load environment from .env if exists
if [[ -f "${SCRIPT_DIR}/../.env" ]]; then
    set -a
    source "${SCRIPT_DIR}/../.env"
    set +a
fi

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

usage() {
    echo "Usage: $0 <backup_file> <database>"
    echo ""
    echo "Arguments:"
    echo "  backup_file  Path to the backup file (.sql.gz)"
    echo "  database     Target database: argus or hermes"
    echo ""
    echo "Examples:"
    echo "  $0 /var/backups/opareta/argus_20231201_120000.sql.gz argus"
    echo "  $0 /var/backups/opareta/hermes_20231201_120000.sql.gz hermes"
    exit 1
}

confirm_restore() {
    local db_name="$1"
    local backup_file="$2"

    echo ""
    echo "WARNING: This will restore the ${db_name} database!"
    echo ""
    echo "  Backup file: ${backup_file}"
    echo "  Database:    ${db_name}"
    echo ""
    echo "This operation will:"
    echo "  1. Drop all existing connections to the database"
    echo "  2. Drop and recreate the database"
    echo "  3. Restore data from the backup"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " response

    if [[ "$response" != "yes" ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

restore_database() {
    local backup_file="$1"
    local db_host="$2"
    local db_port="$3"
    local db_user="$4"
    local db_password="$5"
    local db_name="$6"

    log "Starting restore to ${db_name}..."

    export PGPASSWORD="$db_password"

    # Terminate existing connections
    log "Terminating existing connections..."
    psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}' AND pid <> pg_backend_pid();" \
        > /dev/null 2>&1 || true

    # Drop and recreate database
    log "Dropping and recreating database..."
    psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS ${db_name};"
    psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "CREATE DATABASE ${db_name} OWNER ${db_user};"

    # Restore from backup
    log "Restoring from backup..."
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -q
    else
        psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -q -f "$backup_file"
    fi

    unset PGPASSWORD

    log "Restore completed successfully!"
}

main() {
    if [[ $# -lt 2 ]]; then
        usage
    fi

    local backup_file="$1"
    local target="$2"

    # Validate backup file exists
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi

    log "=========================================="
    log "  Opareta PostgreSQL Restore"
    log "=========================================="

    case "$target" in
        argus)
            confirm_restore "argus" "$backup_file"
            restore_database "$backup_file" "$ARGUS_DB_HOST" "$ARGUS_DB_PORT" "$ARGUS_DB_USER" "$ARGUS_DB_PASSWORD" "$ARGUS_DB_NAME"
            ;;
        hermes)
            confirm_restore "hermes" "$backup_file"
            restore_database "$backup_file" "$HERMES_DB_HOST" "$HERMES_DB_PORT" "$HERMES_DB_USER" "$HERMES_DB_PASSWORD" "$HERMES_DB_NAME"
            ;;
        *)
            error "Unknown database: $target"
            usage
            ;;
    esac

    log "=========================================="
    log "  Restore completed!"
    log "=========================================="
}

main "$@"
