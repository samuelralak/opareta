# Database Restore Procedures

This document outlines the procedures for restoring Opareta PostgreSQL databases from backups.

## Overview

Opareta uses two PostgreSQL databases:
- **Argus DB** (`argus_db`): Authentication service data (users, sessions, tokens)
- **Hermes DB** (`hermes_db`): Payment service data (transactions, accounts, ledger)

## Backup Locations

Backups are stored in `/var/backups/opareta/` with the naming convention:
```
{service}_{YYYYMMDD}_{HHMMSS}.sql.gz
```

Examples:
- `argus_20231201_020000.sql.gz`
- `hermes_20231201_020000.sql.gz`

## Pre-Restore Checklist

Before restoring a database:

1. **Notify stakeholders** - Inform the team about planned downtime
2. **Stop dependent services** - Prevent writes during restore
3. **Verify backup integrity** - Ensure the backup file is valid
4. **Document current state** - Note the current version/state for reference

## Restore Procedures

### Quick Restore (Single Database)

```bash
# Navigate to backup scripts
cd /opt/opareta/infrastructure/backup

# Restore Argus database
./restore-postgres.sh /var/backups/opareta/argus_20231201_020000.sql.gz argus

# Restore Hermes database
./restore-postgres.sh /var/backups/opareta/hermes_20231201_020000.sql.gz hermes
```

### Full System Restore

For a complete disaster recovery:

```bash
# 1. Stop all application services
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml stop \
    argus-1 argus-2 hermes-1 hermes-2

# 2. Restore Argus database
./restore-postgres.sh /var/backups/opareta/argus_TIMESTAMP.sql.gz argus

# 3. Restore Hermes database
./restore-postgres.sh /var/backups/opareta/hermes_TIMESTAMP.sql.gz hermes

# 4. Restart application services
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml up -d \
    argus-1 argus-2 hermes-1 hermes-2

# 5. Verify services are healthy
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml ps
```

### Point-in-Time Recovery

If you need to restore to a specific point in time and have WAL archiving enabled:

```bash
# 1. Stop PostgreSQL
docker compose stop postgres-argus postgres-hermes

# 2. Restore base backup
# 3. Configure recovery.conf with target time
# 4. Start PostgreSQL in recovery mode
```

> **Note**: Point-in-time recovery requires WAL archiving to be configured, which is not included in the default setup.

## Verification Steps

After restoring:

### 1. Check Database Connectivity

```bash
# Test Argus database
docker exec opareta-postgres-argus psql -U argus -d argus_db -c "SELECT 1;"

# Test Hermes database
docker exec opareta-postgres-hermes psql -U hermes -d hermes_db -c "SELECT 1;"
```

### 2. Verify Data Integrity

```bash
# Check Argus tables
docker exec opareta-postgres-argus psql -U argus -d argus_db -c "\dt"

# Check Hermes tables
docker exec opareta-postgres-hermes psql -U hermes -d hermes_db -c "\dt"

# Verify row counts (compare with pre-restore if available)
docker exec opareta-postgres-argus psql -U argus -d argus_db -c "SELECT COUNT(*) FROM users;"
docker exec opareta-postgres-hermes psql -U hermes -d hermes_db -c "SELECT COUNT(*) FROM transactions;"
```

### 3. Check Application Health

```bash
# Check service health endpoints
curl http://localhost:3001/api/health  # Argus instance 1
curl http://localhost:3002/api/health  # Argus instance 2
curl http://localhost:3003/api/health  # Hermes instance 1
curl http://localhost:3004/api/health  # Hermes instance 2
```

### 4. Review Logs

```bash
# Check for database connection errors
docker logs opareta-argus-1 --tail 100
docker logs opareta-hermes-1 --tail 100
```

## Troubleshooting

### Restore Fails with "Database in use"

```bash
# Force disconnect all clients
docker exec opareta-postgres-argus psql -U argus -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'argus_db';"
```

### Restore Fails with Permission Errors

```bash
# Ensure correct ownership
docker exec opareta-postgres-argus psql -U argus -d argus_db -c \
    "REASSIGN OWNED BY postgres TO argus;"
```

### Backup File Corrupted

```bash
# Test gzip integrity
gzip -t /var/backups/opareta/argus_TIMESTAMP.sql.gz

# If corrupted, try previous backup
ls -la /var/backups/opareta/argus_*.sql.gz
```

## Emergency Contacts

- **On-Call Engineer**: Check PagerDuty rotation
- **Database Admin**: [Add contact]
- **Infrastructure Lead**: [Add contact]

## Recovery Time Objectives

| Database | RTO | RPO |
|----------|-----|-----|
| Argus    | 30 min | 24 hours (daily backup) |
| Hermes   | 30 min | 24 hours (daily backup) |

> **Note**: For critical payment data, consider implementing more frequent backups or WAL streaming for near-zero RPO.
