# Opareta Infrastructure

Production infrastructure configuration for deploying Opareta microservices.

## Architecture Overview

The production environment runs on two DigitalOcean droplets:

| Server | Domain | IP | Services |
|--------|--------|-----|----------|
| **Argus** | argus.weekone.app | 159.223.65.64 | Auth service (2 instances), PostgreSQL, Redis, Prometheus, Grafana |
| **Hermes** | hermes.weekone.app | 167.71.201.8 | Payments service (2 instances), PostgreSQL |

## Directory Structure

```
infrastructure/
├── docker/
│   ├── docker-compose.argus.yml    # Argus server stack
│   ├── docker-compose.hermes.yml   # Hermes server stack
│   └── .env.example                # Environment template
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus-argus.yml    # Prometheus config
│   │   └── alerts.yml              # Alert rules
│   └── grafana/
│       ├── dashboards/             # Dashboard configurations
│       └── provisioning/           # Datasource configs
└── nginx/
    └── sites/
        ├── argus.conf              # Argus nginx config
        └── hermes.conf             # Hermes nginx config
```

## Prerequisites

- Two Ubuntu 22.04 servers with Docker installed
- DNS A records pointing to server IPs
- GitHub Container Registry (GHCR) access token
- SSL certificates (via Let's Encrypt)

## Quick Start

### 1. Server Setup

On each server:

```bash
# Install Docker
apt-get update && apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# Create directories
mkdir -p /opt/opareta/infrastructure/{docker,monitoring/prometheus,monitoring/grafana}

# Login to GHCR
echo "YOUR_GHCR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### 2. Deploy Argus Server

```bash
# Copy configuration files
scp -r infrastructure/docker/docker-compose.argus.yml root@159.223.65.64:/opt/opareta/infrastructure/docker/
scp -r infrastructure/monitoring/ root@159.223.65.64:/opt/opareta/infrastructure/

# Create .env file (see Environment Variables section below)
# Then start services
ssh root@159.223.65.64 "cd /opt/opareta/infrastructure/docker && docker compose -f docker-compose.argus.yml up -d"
```

### 3. Deploy Hermes Server

```bash
# Copy configuration files
scp infrastructure/docker/docker-compose.hermes.yml root@167.71.201.8:/opt/opareta/infrastructure/docker/

# Create .env file (see Environment Variables section below)
# Then start services
ssh root@167.71.201.8 "cd /opt/opareta/infrastructure/docker && docker compose -f docker-compose.hermes.yml up -d"
```

### 4. Configure Nginx and SSL

```bash
# On Argus server
certbot --nginx -d argus.weekone.app --non-interactive --agree-tos -m your-email@example.com

# On Hermes server
certbot --nginx -d hermes.weekone.app --non-interactive --agree-tos -m your-email@example.com
```

## Environment Variables

### Argus Server (.env)

```env
DOCKER_REGISTRY=ghcr.io/samuelralak/
IMAGE_TAG=latest
ARGUS_DB_PASSWORD=<secure-password>
GRAFANA_ADMIN_PASSWORD=<secure-password>
JWT_PRIVATE_KEY=<base64-encoded-private-key>
JWT_PUBLIC_KEY=<base64-encoded-public-key>
```

### Hermes Server (.env)

```env
DOCKER_REGISTRY=ghcr.io/samuelralak/
IMAGE_TAG=latest
HERMES_DB_PASSWORD=<secure-password>
ARGUS_SERVER_IP=159.223.65.64
```

### Generating JWT Keys

```bash
# Generate RSA key pair
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Base64 encode for environment variables
JWT_PRIVATE_KEY=$(cat jwt-private.pem | base64 | tr -d '\n')
JWT_PUBLIC_KEY=$(cat jwt-public.pem | base64 | tr -d '\n')
```

## Services

### Argus Stack

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| argus-1 | opareta-argus-1 | 3001 (internal) | Auth service instance 1 |
| argus-2 | opareta-argus-2 | 3002 (internal) | Auth service instance 2 |
| postgres-argus | opareta-postgres-argus | 5432 (internal) | PostgreSQL for Argus |
| redis | opareta-redis | 6379 (public) | Shared Redis cache |
| prometheus | opareta-prometheus | 9090 (internal) | Metrics collection |
| grafana | opareta-grafana | 3100 (public) | Monitoring dashboards |

### Hermes Stack

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| hermes-1 | opareta-hermes-1 | 3001 (internal) | Payments service instance 1 |
| hermes-2 | opareta-hermes-2 | 3002 (internal) | Payments service instance 2 |
| postgres-hermes | opareta-postgres-hermes | 5432 (internal) | PostgreSQL for Hermes |

## Endpoints

### Public Endpoints

| Endpoint | URL |
|----------|-----|
| Argus API | https://argus.weekone.app/api/ |
| Argus JWKS | https://argus.weekone.app/api/.well-known/jwks.json |
| Hermes API | https://hermes.weekone.app/api/ |
| Grafana | http://159.223.65.64:3100 |

### Internal Endpoints (via nginx)

| Service | Upstream |
|---------|----------|
| Argus | 127.0.0.1:3001, 127.0.0.1:3002 |
| Hermes | 127.0.0.1:3001, 127.0.0.1:3002 |

## Operations

### View Logs

```bash
# Argus
ssh root@159.223.65.64 "docker logs -f opareta-argus-1"

# Hermes
ssh root@167.71.201.8 "docker logs -f opareta-hermes-1"
```

### Check Service Status

```bash
# Argus
ssh root@159.223.65.64 "docker compose -f /opt/opareta/infrastructure/docker/docker-compose.argus.yml ps"

# Hermes
ssh root@167.71.201.8 "docker compose -f /opt/opareta/infrastructure/docker/docker-compose.hermes.yml ps"
```

### Restart Services

```bash
# Restart specific service
ssh root@159.223.65.64 "docker compose -f /opt/opareta/infrastructure/docker/docker-compose.argus.yml restart argus-1"

# Restart all services
ssh root@159.223.65.64 "docker compose -f /opt/opareta/infrastructure/docker/docker-compose.argus.yml up -d"
```

### Pull Latest Images

```bash
# Pull and restart with latest images
ssh root@159.223.65.64 "cd /opt/opareta/infrastructure/docker && docker compose -f docker-compose.argus.yml pull && docker compose -f docker-compose.argus.yml up -d"
```

## Monitoring

### Prometheus

Access Prometheus at `http://159.223.65.64:9090` (internal only via nginx).

**Scraped targets:**
- Prometheus self-metrics
- Argus instances (`/api/metrics`)

### Grafana

Access Grafana at `http://159.223.65.64:3100`

**Credentials:**
- Username: `admin`
- Password: Set via `GRAFANA_ADMIN_PASSWORD`

**Datasource:** Prometheus is auto-configured.

## SSL Certificate Renewal

Let's Encrypt certificates auto-renew via certbot timer:

```bash
# Check timer status
systemctl status certbot.timer

# Manual renewal
certbot renew --dry-run
```

## Building and Pushing Images

```bash
# Build for linux/amd64 and push to GHCR
docker buildx build --platform linux/amd64 --build-arg APP=argus -t ghcr.io/samuelralak/argus:latest --push .
docker buildx build --platform linux/amd64 --build-arg APP=hermes -t ghcr.io/samuelralak/hermes:latest --push .
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker logs <container-name>

# Check environment variables
docker compose -f docker-compose.argus.yml config
```

### Connection Issues

```bash
# Test service connectivity
curl -s https://argus.weekone.app/api/.well-known/jwks.json

# Test internal nginx proxy
curl -s http://localhost/api/.well-known/jwks.json
```

### Database Issues

```bash
# Connect to Argus database
docker exec -it opareta-postgres-argus psql -U argus -d argus_db

# Connect to Hermes database
docker exec -it opareta-postgres-hermes psql -U hermes -d hermes_db
```
