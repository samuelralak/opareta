#!/bin/bash
#
# Firewall Configuration Script
# =============================
# Configures UFW firewall rules for Opareta services.
#
# Usage: sudo ./setup-firewall.sh
#
# Rules:
#   - Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS)
#   - Restrict: 5432, 5433 (PostgreSQL), 6379 (Redis) to localhost only
#
# This script is idempotent - safe to run multiple times.
#

set -euo pipefail

LOG_PREFIX="[setup-firewall]"

log() { echo "${LOG_PREFIX} $*"; }
error() { echo "${LOG_PREFIX} ERROR: $*" >&2; }

install_ufw() {
    if ! command -v ufw &>/dev/null; then
        log "Installing UFW..."
        apt-get update -qq
        apt-get install -y -qq ufw
    else
        log "UFW is already installed"
    fi
}

configure_ufw() {
    log "Configuring UFW rules..."

    # Reset to defaults (deny incoming, allow outgoing)
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH (always first to avoid lockout)
    ufw allow 22/tcp comment 'SSH'

    # Allow HTTP and HTTPS
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'

    # Allow Prometheus metrics (for monitoring server)
    # Uncomment if you have a separate monitoring server
    # ufw allow from <monitoring-server-ip> to any port 9090 comment 'Prometheus'
    # ufw allow from <monitoring-server-ip> to any port 9100 comment 'Node Exporter'

    # PostgreSQL - localhost only (Docker handles internal networking)
    # These are blocked by default (deny incoming), but we explicitly deny for clarity
    ufw deny 5432/tcp comment 'PostgreSQL Argus - blocked externally'
    ufw deny 5433/tcp comment 'PostgreSQL Hermes - blocked externally'

    # Redis - localhost only
    ufw deny 6379/tcp comment 'Redis - blocked externally'

    log "UFW rules configured"
}

enable_ufw() {
    log "Enabling UFW..."

    # Enable UFW (--force to avoid interactive prompt)
    ufw --force enable

    log "UFW enabled"
}

show_status() {
    log "Current UFW status:"
    ufw status verbose
}

main() {
    log "Starting firewall setup..."

    install_ufw
    configure_ufw
    enable_ufw
    show_status

    log "Firewall setup complete!"
}

main "$@"
