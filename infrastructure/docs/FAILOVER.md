# Failover Procedures

This document outlines failover procedures for Opareta services during various failure scenarios.

## Architecture Overview

```
                    ┌─────────────┐
                    │   Nginx     │
                    │   (LB)      │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Argus-1    │ │  Argus-2    │ │  Hermes-1   │ ...
    │  (3001)     │ │  (3002)     │ │  (3003)     │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
       │ PostgreSQL  │ │ Redis │ │ PostgreSQL  │
       │   Argus     │ │       │ │   Hermes    │
       └─────────────┘ └───────┘ └─────────────┘
```

## Failure Scenarios

### 1. Single Service Instance Failure

**Detection**: Prometheus alerts, Nginx health checks fail

**Automatic Handling**:
- Nginx removes unhealthy instance from load balancer
- Docker restart policy attempts to restart container
- Other instance continues serving traffic

**Manual Intervention** (if auto-restart fails):

```bash
# Check container status
docker ps -a | grep opareta

# View logs
docker logs opareta-argus-1 --tail 100

# Manually restart
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml \
    restart argus-1
```

### 2. All Instances of a Service Down

**Detection**: `ServiceCompletelyDown` alert

**Immediate Actions**:

```bash
# 1. Check if database is accessible
docker exec opareta-postgres-argus pg_isready

# 2. Check Redis
docker exec opareta-redis redis-cli ping

# 3. Restart all instances
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml \
    restart argus-1 argus-2

# 4. If restart fails, check for resource exhaustion
docker stats --no-stream
df -h
free -m
```

### 3. Database Failure

**Detection**: Service logs show connection errors, health checks fail

#### PostgreSQL Recovery

```bash
# Check PostgreSQL status
docker logs opareta-postgres-argus --tail 100

# If container is running but not accepting connections
docker exec opareta-postgres-argus pg_isready

# Restart PostgreSQL
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml \
    restart postgres-argus

# If data corruption suspected, restore from backup
# See RESTORE.md for detailed procedures
```

#### Redis Recovery

```bash
# Check Redis status
docker logs opareta-redis --tail 100

# Test connection
docker exec opareta-redis redis-cli ping

# Restart Redis
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml \
    restart redis

# Clear cache if corrupted (service will repopulate)
docker exec opareta-redis redis-cli FLUSHALL
```

### 4. Server/Host Failure

**Detection**: All services unreachable, monitoring shows host down

**Recovery Steps**:

```bash
# 1. If server is recoverable, SSH in and restart Docker
sudo systemctl restart docker
cd /opt/opareta/infrastructure/docker
docker compose -f docker-compose.prod.yml up -d

# 2. If server is not recoverable:
#    a. Provision new server (see infrastructure/scripts/provision.sh)
#    b. Deploy application
#    c. Restore databases from backup
#    d. Update DNS if needed
```

### 5. Network Issues

**Symptoms**: Intermittent failures, timeouts, partial connectivity

**Diagnosis**:

```bash
# Check container networking
docker network ls
docker network inspect opareta_default

# Test inter-container connectivity
docker exec opareta-argus-1 wget -qO- http://redis:6379 || echo "Redis unreachable"
docker exec opareta-argus-1 wget -qO- http://postgres-argus:5432 || echo "PostgreSQL unreachable"

# Restart Docker networking
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml down
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.prod.yml up -d
```

### 6. Disk Space Exhaustion

**Detection**: `LowDiskSpace` or `CriticalDiskSpace` alerts

**Immediate Actions**:

```bash
# Check disk usage
df -h

# Find large files
du -sh /var/lib/docker/*

# Clean Docker resources
docker system prune -f
docker volume prune -f

# Clean old logs
journalctl --vacuum-time=3d
find /var/log -name "*.log" -mtime +7 -delete

# Clean old backups (if emergency)
find /var/backups/opareta -mtime +3 -delete
```

## Rollback Procedures

### Application Rollback

```bash
# Rollback to previous version
cd /opt/opareta/infrastructure/deploy
./rollback.sh

# Or rollback specific service
./rollback.sh argus
./rollback.sh hermes

# Or rollback to specific version
./rollback.sh argus v1.0.0
```

### Database Rollback

```bash
# See RESTORE.md for full procedures
cd /opt/opareta/infrastructure/backup
./restore-postgres.sh /var/backups/opareta/argus_TIMESTAMP.sql.gz argus
```

## Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Nginx | `http://localhost/health` | 200 OK |
| Argus-1 | `http://localhost:3001/api/health` | 200 + JSON |
| Argus-2 | `http://localhost:3002/api/health` | 200 + JSON |
| Hermes-1 | `http://localhost:3003/api/health` | 200 + JSON |
| Hermes-2 | `http://localhost:3004/api/health` | 200 + JSON |
| Prometheus | `http://localhost:9090/-/healthy` | 200 Prometheus Server is Healthy |
| Grafana | `http://localhost:3100/api/health` | 200 + JSON |

## Monitoring Dashboards

- **Grafana**: `http://localhost:3100` (admin / [see env])
- **Prometheus**: `http://localhost:9090`
- **Prometheus Alerts**: `http://localhost:9090/alerts`

## Communication Templates

### Initial Incident Alert

```
[INCIDENT] Opareta Service Degradation
Time: [TIMESTAMP]
Severity: [Critical/Warning]
Affected Services: [List]
Status: Investigating
Next Update: [Time]
```

### Resolution Notice

```
[RESOLVED] Opareta Service Degradation
Time: [TIMESTAMP]
Duration: [X minutes]
Root Cause: [Brief description]
Resolution: [What was done]
Follow-up: [Any post-incident actions]
```

## Escalation Matrix

| Level | Trigger | Who | Response Time |
|-------|---------|-----|---------------|
| L1 | Single instance down | On-call Engineer | 5 min |
| L2 | Service completely down | Senior Engineer | 10 min |
| L3 | Multiple services down | Tech Lead | 15 min |
| L4 | Complete outage | Engineering Manager | Immediate |

## Post-Incident

After resolving any incident:

1. **Document** what happened in the incident log
2. **Review** alert effectiveness
3. **Update** runbooks if needed
4. **Schedule** post-mortem for major incidents
5. **Create** follow-up tickets for improvements
