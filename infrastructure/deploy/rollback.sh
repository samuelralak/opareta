#!/bin/bash
#
# Rollback Script
# ===============
# Rolls back Opareta services to the previous version.
#
# Usage:
#   ./rollback.sh              # Rollback all services
#   ./rollback.sh argus        # Rollback only Argus
#   ./rollback.sh hermes       # Rollback only Hermes
#   ./rollback.sh argus v1.1.0 # Rollback Argus to specific version
#
# The script uses saved previous image tags from /tmp/opareta-*-previous-image
# or you can specify a version explicitly.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../docker/docker-compose.prod.yml"
LOG_PREFIX="[rollback]"

# Load environment from .env if exists
if [[ -f "${SCRIPT_DIR}/../.env" ]]; then
    set -a
    source "${SCRIPT_DIR}/../.env"
    set +a
fi

# Configuration
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

get_previous_image() {
    local service="$1"
    local file="/tmp/opareta-${service}-previous-image"

    if [[ -f "$file" ]]; then
        cat "$file"
    else
        echo ""
    fi
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
            return 1
        fi

        log "Health check $i/$retries: status=$status"
        sleep "$interval"
    done

    error "$container failed to become healthy"
    return 1
}

rollback_instance() {
    local service="$1"
    local image="$2"
    local container="opareta-${service}"

    log "Rolling back $service to $image..."

    # Extract tag from full image name
    local tag="${image##*:}"

    # Stop and remove current container
    docker compose -f "$COMPOSE_FILE" stop "$service" || true
    docker compose -f "$COMPOSE_FILE" rm -f "$service" || true

    # Start with previous image
    export IMAGE_TAG="$tag"
    docker compose -f "$COMPOSE_FILE" up -d "$service"

    # Wait for health
    if ! wait_for_health "$container"; then
        error "Rollback of $service failed!"
        return 1
    fi

    info "$service rolled back successfully ✓"
}

rollback_service() {
    local service_prefix="$1"
    local target_version="${2:-}"

    info "Starting rollback for $service_prefix..."

    local instance1="${service_prefix}-1"
    local instance2="${service_prefix}-2"

    # Get previous images
    local image1 image2

    if [[ -n "$target_version" ]]; then
        # Use specified version
        local registry="${DOCKER_REGISTRY:-}"
        local image_base="${registry}opareta/${service_prefix}"
        image1="${image_base}:${target_version}"
        image2="${image_base}:${target_version}"
    else
        # Use saved previous versions
        image1=$(get_previous_image "$instance1")
        image2=$(get_previous_image "$instance2")

        if [[ -z "$image1" ]] || [[ -z "$image2" ]]; then
            error "No previous version found for $service_prefix"
            error "Use: $0 $service_prefix <version> to specify a version"
            return 1
        fi
    fi

    log "Rolling back to images:"
    log "  $instance1: $image1"
    log "  $instance2: $image2"

    # Rollback instance 2 first (reverse order)
    if ! rollback_instance "$instance2" "$image2"; then
        error "Failed to rollback $instance2"
        return 1
    fi

    # Rollback instance 1
    if ! rollback_instance "$instance1" "$image1"; then
        error "Failed to rollback $instance1"
        return 1
    fi

    info "Rollback of $service_prefix completed ✓"
}

verify_rollback() {
    local services=("$@")

    log "Verifying rollback..."

    local all_healthy=true

    for service in "${services[@]}"; do
        local container="opareta-${service}"
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")

        if [[ "$status" == "healthy" ]]; then
            local image
            image=$(docker inspect --format='{{.Config.Image}}' "$container")
            info "$container: healthy ($image) ✓"
        else
            error "$container: $status"
            all_healthy=false
        fi
    done

    $all_healthy
}

main() {
    local target="${1:-all}"
    local version="${2:-}"

    info "=========================================="
    info "  Opareta Rollback"
    info "=========================================="
    info "Target: $target"
    [[ -n "$version" ]] && info "Version: $version"
    info ""

    case "$target" in
        argus)
            rollback_service "argus" "$version"
            verify_rollback "argus-1" "argus-2"
            ;;
        hermes)
            rollback_service "hermes" "$version"
            verify_rollback "hermes-1" "hermes-2"
            ;;
        all)
            rollback_service "argus" "$version"
            rollback_service "hermes" "$version"
            verify_rollback "argus-1" "argus-2" "hermes-1" "hermes-2"
            ;;
        *)
            error "Unknown target: $target"
            echo ""
            echo "Usage: $0 [argus|hermes|all] [version]"
            exit 1
            ;;
    esac

    info "=========================================="
    info "  Rollback completed!"
    info "=========================================="
}

main "$@"
