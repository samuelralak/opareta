#!/bin/bash
#
# Zero-Downtime Deployment Script
# ================================
# Performs rolling deployments for Opareta services.
#
# Usage:
#   ./deploy.sh                    # Deploy latest images
#   ./deploy.sh v1.2.3             # Deploy specific version
#   IMAGE_TAG=v1.2.3 ./deploy.sh   # Using environment variable
#
# Environment variables:
#   - IMAGE_TAG: Docker image tag to deploy (default: latest)
#   - DOCKER_REGISTRY: Docker registry URL (optional)
#   - HEALTH_CHECK_RETRIES: Number of health check retries (default: 30)
#   - HEALTH_CHECK_INTERVAL: Seconds between health checks (default: 2)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../docker/docker-compose.prod.yml"
LOG_PREFIX="[deploy]"

# Load environment from .env if exists
if [[ -f "${SCRIPT_DIR}/../.env" ]]; then
    set -a
    source "${SCRIPT_DIR}/../.env"
    set +a
fi

# Configuration
IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-2}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_PREFIX} $*"; }
info() { log "${GREEN}$*${NC}"; }
warn() { log "${YELLOW}$*${NC}"; }
error() { log "${RED}$*${NC}" >&2; }

# Store current image tag for potential rollback
save_current_version() {
    local service="$1"
    local current_image

    current_image=$(docker inspect --format='{{.Config.Image}}' "opareta-${service}" 2>/dev/null || echo "")

    if [[ -n "$current_image" ]]; then
        echo "$current_image" > "/tmp/opareta-${service}-previous-image"
        log "Saved current version: $current_image"
    fi
}

pull_images() {
    log "Pulling images with tag: ${IMAGE_TAG}..."

    export IMAGE_TAG
    export DOCKER_REGISTRY

    docker compose -f "$COMPOSE_FILE" pull argus-1 argus-2 hermes-1 hermes-2

    info "Images pulled successfully"
}

wait_for_health() {
    local container="$1"
    local retries="$HEALTH_CHECK_RETRIES"
    local interval="$HEALTH_CHECK_INTERVAL"

    log "Waiting for $container to be healthy..."

    for ((i=1; i<=retries; i++)); do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")

        if [[ "$status" == "healthy" ]]; then
            info "$container is healthy ✓"
            return 0
        fi

        if [[ "$status" == "unhealthy" ]]; then
            error "$container is unhealthy!"
            docker logs --tail 50 "$container"
            return 1
        fi

        log "Health check $i/$retries: status=$status"
        sleep "$interval"
    done

    error "$container failed to become healthy after $((retries * interval)) seconds"
    docker logs --tail 50 "$container"
    return 1
}

deploy_instance() {
    local service="$1"
    local container="opareta-${service}"

    log "Deploying $service..."

    # Stop the instance
    log "Stopping $container..."
    docker compose -f "$COMPOSE_FILE" stop "$service" || true

    # Remove the old container
    docker compose -f "$COMPOSE_FILE" rm -f "$service" || true

    # Start the new instance
    log "Starting $container with tag ${IMAGE_TAG}..."
    export IMAGE_TAG
    docker compose -f "$COMPOSE_FILE" up -d "$service"

    # Wait for health check
    if ! wait_for_health "$container"; then
        error "Deployment of $service failed!"
        return 1
    fi

    info "$service deployed successfully ✓"
    return 0
}

rolling_deploy() {
    local service_prefix="$1"
    local instance1="${service_prefix}-1"
    local instance2="${service_prefix}-2"

    info "Starting rolling deployment for $service_prefix..."

    # Save current versions for rollback
    save_current_version "$instance1"
    save_current_version "$instance2"

    # Deploy instance 1
    if ! deploy_instance "$instance1"; then
        error "Failed to deploy $instance1. Aborting."
        return 1
    fi

    # Deploy instance 2
    if ! deploy_instance "$instance2"; then
        error "Failed to deploy $instance2. Rolling back $instance1..."
        # Attempt to rollback instance 1
        warn "Attempting rollback of $instance1..."
        "${SCRIPT_DIR}/rollback.sh" "$service_prefix" || true
        return 1
    fi

    info "Rolling deployment of $service_prefix completed ✓"
}

verify_deployment() {
    log "Verifying deployment..."

    local services=("argus-1" "argus-2" "hermes-1" "hermes-2")
    local all_healthy=true

    for service in "${services[@]}"; do
        local container="opareta-${service}"
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")

        if [[ "$status" == "healthy" ]]; then
            info "$container: healthy ✓"
        else
            error "$container: $status"
            all_healthy=false
        fi
    done

    if $all_healthy; then
        info "All services are healthy!"
        return 0
    else
        error "Some services are not healthy!"
        return 1
    fi
}

main() {
    info "=========================================="
    info "  Opareta Zero-Downtime Deployment"
    info "=========================================="
    info "Image tag: ${IMAGE_TAG}"
    info "Registry: ${DOCKER_REGISTRY:-docker.io}"
    info ""

    # Verify compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    # Pull new images
    pull_images

    # Deploy Argus (Auth service)
    if ! rolling_deploy "argus"; then
        error "Argus deployment failed!"
        exit 1
    fi

    # Deploy Hermes (Payments service)
    if ! rolling_deploy "hermes"; then
        error "Hermes deployment failed!"
        exit 1
    fi

    # Final verification
    if ! verify_deployment; then
        error "Deployment verification failed!"
        exit 1
    fi

    info "=========================================="
    info "  Deployment completed successfully!"
    info "=========================================="
    info "Deployed version: ${IMAGE_TAG}"
}

main "$@"
