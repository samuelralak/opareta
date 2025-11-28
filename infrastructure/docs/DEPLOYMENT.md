# Opareta Deployment Guide

This guide covers deploying Opareta microservices to production using a two-server architecture on DigitalOcean.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Deploy Argus Server](#deploy-argus-server)
- [Deploy Hermes Server](#deploy-hermes-server)
- [SSL Configuration](#ssl-configuration)
- [GitHub Actions Setup](#github-actions-setup)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

The production environment runs on two DigitalOcean droplets:

| Server | Domain | Services |
|--------|--------|----------|
| **Argus** | argus.weekone.app | Auth service (2 instances), PostgreSQL, Redis, Prometheus, Grafana |
| **Hermes** | hermes.weekone.app | Payments service (2 instances), PostgreSQL |

Hermes connects to Argus for:
- JWT validation via JWKS endpoint (`https://argus.weekone.app/api/.well-known/jwks.json`)
- Redis caching (shared across services)

## Prerequisites

### Local Machine

- SSH key pair (`~/.ssh/id_ed25519` or `~/.ssh/id_rsa`)
- OpenSSL installed (for JWT key generation)
- Git configured

### GitHub

- Repository with Opareta code
- Personal Access Token (PAT) with `read:packages`, `write:packages` scopes
- Repository secrets configured (for CI/CD)

### DigitalOcean

- Account with billing enabled
- SSH key added to your account
- Two droplets created (Ubuntu 22.04, 4GB RAM minimum each)
- DNS A records pointing to server IPs

## Server Setup

On **each server**, run:

```bash
# Install dependencies
apt-get update && apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# Create directories
mkdir -p /opt/opareta/infrastructure/{docker,monitoring/prometheus,monitoring/grafana}

# Login to GitHub Container Registry
echo "YOUR_GHCR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

## Deploy Argus Server

### 1. Generate JWT Keys (one-time)

```bash
# Generate RSA key pair
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Base64 encode for environment variables
JWT_PRIVATE_KEY=$(cat jwt-private.pem | base64 | tr -d '\n')
JWT_PUBLIC_KEY=$(cat jwt-public.pem | base64 | tr -d '\n')

echo "JWT_PRIVATE_KEY=$JWT_PRIVATE_KEY"
echo "JWT_PUBLIC_KEY=$JWT_PUBLIC_KEY"
```

### 2. Copy Configuration Files

```bash
scp infrastructure/docker/docker-compose.argus.yml root@ARGUS_IP:/opt/opareta/infrastructure/docker/
scp -r infrastructure/monitoring/ root@ARGUS_IP:/opt/opareta/infrastructure/
```

### 3. Create Environment File on Server

```bash
ssh root@ARGUS_IP "cat > /opt/opareta/infrastructure/docker/.env << 'EOF'
DOCKER_REGISTRY=ghcr.io/YOUR_USERNAME/
IMAGE_TAG=latest
ARGUS_DB_PASSWORD=<secure-password>
GRAFANA_ADMIN_PASSWORD=<secure-password>
JWT_PRIVATE_KEY=<base64-encoded-private-key>
JWT_PUBLIC_KEY=<base64-encoded-public-key>
JWT_EXPIRATION_SECONDS=7200
EOF"
```

### 4. Start Services

```bash
ssh root@ARGUS_IP "cd /opt/opareta/infrastructure/docker && docker compose -f docker-compose.argus.yml up -d"
```

### 5. Configure Nginx

Copy nginx config and enable:
```bash
scp infrastructure/nginx/sites/argus.conf root@ARGUS_IP:/etc/nginx/sites-available/
ssh root@ARGUS_IP "ln -sf /etc/nginx/sites-available/argus.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
```

## Deploy Hermes Server

### 1. Copy Configuration Files

```bash
scp infrastructure/docker/docker-compose.hermes.yml root@HERMES_IP:/opt/opareta/infrastructure/docker/
```

### 2. Create Environment File on Server

```bash
ssh root@HERMES_IP "cat > /opt/opareta/infrastructure/docker/.env << 'EOF'
DOCKER_REGISTRY=ghcr.io/YOUR_USERNAME/
IMAGE_TAG=latest
HERMES_DB_PASSWORD=<secure-password>
ARGUS_SERVER_IP=<argus-server-ip>
EOF"
```

### 3. Start Services

```bash
ssh root@HERMES_IP "cd /opt/opareta/infrastructure/docker && docker compose -f docker-compose.hermes.yml up -d"
```

### 4. Configure Nginx

```bash
scp infrastructure/nginx/sites/hermes.conf root@HERMES_IP:/etc/nginx/sites-available/
ssh root@HERMES_IP "ln -sf /etc/nginx/sites-available/hermes.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
```

## SSL Configuration

On each server, run certbot:

```bash
# Argus server
ssh root@ARGUS_IP "certbot --nginx -d argus.weekone.app --non-interactive --agree-tos -m your-email@example.com"

# Hermes server
ssh root@HERMES_IP "certbot --nginx -d hermes.weekone.app --non-interactive --agree-tos -m your-email@example.com"
```

Certificates auto-renew via certbot timer.

## GitHub Actions Setup

### Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | Server IP address |
| `SERVER_USER` | SSH user (default: `root`) |
| `SERVER_SSH_KEY` | Private SSH key (entire content) |
| `GHCR_TOKEN` | GitHub PAT with `read:packages` |

### Generate SSH Key for GitHub Actions

```bash
# Generate dedicated deploy key
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""

# Add public key to server
ssh-copy-id -i ~/.ssh/deploy_key.pub root@YOUR_SERVER_IP

# Copy private key content to GitHub secret
cat ~/.ssh/deploy_key
```

### Workflow Triggers

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push/PR | Lint, test, typecheck |
| `build-and-push.yml` | Push to main | Build and push images to GHCR |
| `build-and-push.yml` | Release | Build with version tag, trigger deploy |
| `deploy.yml` | Manual / Release | Deploy to production |

### Manual Deployment

1. Go to Actions → Deploy
2. Click "Run workflow"
3. Enter image tag (e.g., `latest`, `v1.0.0`, `sha-abc1234`)
4. Select environment
5. Click "Run workflow"

### Automated Deployment on Release

1. Create a new release on GitHub
2. Tag with semver (e.g., `v1.0.0`)
3. Publish release
4. `build-and-push.yml` builds images with version tag
5. `deploy.yml` automatically deploys to production

## Architecture

```
┌─────────────────────────────────────────┐     ┌─────────────────────────────────────────┐
│         Argus Server (159.223.65.64)    │     │         Hermes Server (167.71.201.8)    │
│         argus.weekone.app               │     │         hermes.weekone.app              │
├─────────────────────────────────────────┤     ├─────────────────────────────────────────┤
│                                         │     │                                         │
│  ┌───────────────────────────────────┐  │     │  ┌───────────────────────────────────┐  │
│  │         Nginx (80/443)            │  │     │  │         Nginx (80/443)            │  │
│  │         SSL + Load Balancing      │  │     │  │         SSL + Load Balancing      │  │
│  └─────────────┬─────────────────────┘  │     │  └─────────────┬─────────────────────┘  │
│                │                        │     │                │                        │
│       ┌────────┴────────┐               │     │       ┌────────┴────────┐               │
│       │                 │               │     │       │                 │               │
│  ┌────▼────┐       ┌────▼────┐          │     │  ┌────▼────┐       ┌────▼────┐          │
│  │ Argus-1 │       │ Argus-2 │          │     │  │Hermes-1 │       │Hermes-2 │          │
│  │ (:3001) │       │ (:3002) │          │     │  │ (:3001) │       │ (:3002) │          │
│  └────┬────┘       └────┬────┘          │     │  └────┬────┘       └────┬────┘          │
│       │                 │               │     │       │                 │               │
│       └────────┬────────┘               │     │       └────────┬────────┘               │
│                │                        │     │                │                        │
│  ┌─────────────┴─────────────┐          │     │  ┌─────────────┴─────────────┐          │
│  │                           │          │     │  │                           │          │
│  │  ┌─────────┐  ┌─────────┐ │          │     │  │       ┌─────────┐         │          │
│  │  │Postgres │  │  Redis  │ │          │◄────┼──┼───────│Postgres │         │          │
│  │  │ (:5432) │  │ (:6379) │ │  JWKS    │     │  │       │ (:5432) │         │          │
│  │  └─────────┘  └────┬────┘ │  + Redis │     │  │       └─────────┘         │          │
│  │                    │      │          │     │  │                           │          │
│  └────────────────────┼──────┘          │     │  └───────────────────────────┘          │
│                       │                 │     │                                         │
│  ┌────────────────────┴──────────────┐  │     │                                         │
│  │  Prometheus (:9090)               │  │     │                                         │
│  │  Grafana (:3100)                  │  │     │                                         │
│  └───────────────────────────────────┘  │     │                                         │
│                                         │     │                                         │
└─────────────────────────────────────────┘     └─────────────────────────────────────────┘
```

## Ports Reference

### Argus Server

| Port | Service | Access |
|------|---------|--------|
| 22 | SSH | Public (key-only) |
| 80 | Nginx HTTP | Public |
| 443 | Nginx HTTPS | Public |
| 3001-3002 | Argus instances | localhost only |
| 5432 | PostgreSQL | localhost only |
| 6379 | Redis | Public (for Hermes) |
| 9090 | Prometheus | localhost only |
| 3100 | Grafana | Public |

### Hermes Server

| Port | Service | Access |
|------|---------|--------|
| 22 | SSH | Public (key-only) |
| 80 | Nginx HTTP | Public |
| 443 | Nginx HTTPS | Public |
| 3001-3002 | Hermes instances | localhost only |
| 5432 | PostgreSQL | localhost only |

## Troubleshooting

### Cannot Connect via SSH

```bash
# Check if SSH is running
ssh -v root@SERVER_IP

# If locked out, use DigitalOcean console
# Reset root password via control panel
```

### Services Not Starting

```bash
# Check Docker status
systemctl status docker

# Check container logs (Argus server)
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.argus.yml logs

# Check container logs (Hermes server)
docker compose -f /opt/opareta/infrastructure/docker/docker-compose.hermes.yml logs

# Check specific service
docker logs opareta-argus-1
docker logs opareta-hermes-1
```

### Database Connection Issues

```bash
# Check PostgreSQL is healthy (Argus)
docker exec opareta-postgres-argus pg_isready -U argus -d argus_db

# Check PostgreSQL is healthy (Hermes)
docker exec opareta-postgres-hermes pg_isready -U hermes -d hermes_db

# Check connectivity from app container
docker exec opareta-argus-1 nc -zv postgres-argus 5432
```

### Nginx 502 Bad Gateway

```bash
# Check if upstream services are running
curl http://localhost:3001/api/.well-known/jwks.json  # Argus
curl http://localhost:3001/api/health                  # Hermes

# Check Nginx config
nginx -t

# Check Nginx logs
tail -f /var/log/nginx/error.log
```

### Cross-Server Connectivity Issues

```bash
# From Hermes, test JWKS endpoint
curl -s https://argus.weekone.app/api/.well-known/jwks.json

# From Hermes, test Redis connectivity
nc -zv ARGUS_IP 6379
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes
```

## Security Checklist

- [ ] SSH key-only authentication enabled
- [ ] Root password login disabled
- [ ] UFW firewall enabled (allow 22, 80, 443, 6379 on Argus)
- [ ] Database ports blocked from external access
- [ ] Strong passwords for all services
- [ ] SSL certificates configured via Let's Encrypt
- [ ] Redis protected by firewall (only accessible from Hermes IP)
- [ ] Monitoring alerts configured in Grafana

## Verification Commands

```bash
# Verify all Argus services are healthy
ssh root@159.223.65.64 "docker compose -f /opt/opareta/infrastructure/docker/docker-compose.argus.yml ps"

# Verify all Hermes services are healthy
ssh root@167.71.201.8 "docker compose -f /opt/opareta/infrastructure/docker/docker-compose.hermes.yml ps"

# Test API endpoints
curl -s https://argus.weekone.app/api/.well-known/jwks.json | jq
curl -s https://hermes.weekone.app/api/health
```
