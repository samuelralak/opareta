#!/bin/bash
#
# Docker Installation Script
# ==========================
# Installs Docker CE and Docker Compose v2 on Ubuntu 22.04
#
# Usage: sudo ./setup-docker.sh
#
# This script is idempotent - safe to run multiple times.
#

set -euo pipefail

LOG_PREFIX="[setup-docker]"

log() { echo "${LOG_PREFIX} $*"; }
error() { echo "${LOG_PREFIX} ERROR: $*" >&2; }

# Check if Docker is already installed and running
check_docker_installed() {
    if command -v docker &>/dev/null && docker --version &>/dev/null; then
        log "Docker is already installed: $(docker --version)"
        return 0
    fi
    return 1
}

# Check if Docker Compose v2 is installed
check_compose_installed() {
    if docker compose version &>/dev/null; then
        log "Docker Compose is already installed: $(docker compose version)"
        return 0
    fi
    return 1
}

install_docker() {
    log "Installing Docker CE..."

    # Remove old versions if present
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    # Install prerequisites
    apt-get update -qq
    apt-get install -y -qq \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
    fi

    # Set up the repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update -qq
    apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    log "Docker CE installed successfully"
}

configure_docker() {
    log "Configuring Docker..."

    # Create docker group if it doesn't exist
    if ! getent group docker &>/dev/null; then
        groupadd docker
    fi

    # Configure Docker daemon with production settings
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json <<EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2",
    "live-restore": true,
    "builder": {
        "gc": {
            "enabled": true,
            "defaultKeepStorage": "20GB"
        }
    }
}
EOF

    # Enable and start Docker
    systemctl enable docker
    systemctl restart docker

    log "Docker configured and started"
}

verify_installation() {
    log "Verifying Docker installation..."

    if ! docker run --rm hello-world &>/dev/null; then
        error "Docker verification failed!"
        return 1
    fi

    log "Docker verification passed ✓"
    log "Docker version: $(docker --version)"
    log "Docker Compose version: $(docker compose version)"
}

main() {
    log "Starting Docker setup..."

    if check_docker_installed && check_compose_installed; then
        log "Docker and Docker Compose are already installed"
    else
        install_docker
    fi

    configure_docker
    verify_installation

    log "Docker setup complete!"
}

main "$@"
