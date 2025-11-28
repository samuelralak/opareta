#!/bin/bash
#
# Monitoring Agents Setup Script
# ==============================
# Installs and configures monitoring agents for Opareta.
#
# Usage: sudo ./setup-monitoring-agents.sh
#
# Installs:
#   - node_exporter (Prometheus metrics for system resources)
#
# This script is idempotent - safe to run multiple times.
#

set -euo pipefail

LOG_PREFIX="[setup-monitoring]"
NODE_EXPORTER_VERSION="1.7.0"
NODE_EXPORTER_USER="node_exporter"

log() { echo "${LOG_PREFIX} $*"; }
error() { echo "${LOG_PREFIX} ERROR: $*" >&2; }

check_node_exporter() {
    if command -v node_exporter &>/dev/null && systemctl is-active --quiet node_exporter; then
        log "node_exporter is already installed and running"
        return 0
    fi
    return 1
}

create_user() {
    if ! id "$NODE_EXPORTER_USER" &>/dev/null; then
        log "Creating node_exporter user..."
        useradd --no-create-home --shell /bin/false "$NODE_EXPORTER_USER"
    else
        log "node_exporter user already exists"
    fi
}

install_node_exporter() {
    log "Installing node_exporter v${NODE_EXPORTER_VERSION}..."

    local arch="amd64"
    local download_url="https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-${arch}.tar.gz"
    local tmp_dir=$(mktemp -d)

    # Download and extract
    cd "$tmp_dir"
    curl -sLO "$download_url"
    tar xzf "node_exporter-${NODE_EXPORTER_VERSION}.linux-${arch}.tar.gz"

    # Install binary
    cp "node_exporter-${NODE_EXPORTER_VERSION}.linux-${arch}/node_exporter" /usr/local/bin/
    chown "$NODE_EXPORTER_USER:$NODE_EXPORTER_USER" /usr/local/bin/node_exporter
    chmod 755 /usr/local/bin/node_exporter

    # Cleanup
    rm -rf "$tmp_dir"

    log "node_exporter installed to /usr/local/bin/node_exporter"
}

create_systemd_service() {
    log "Creating systemd service for node_exporter..."

    cat > /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
Documentation=https://prometheus.io/docs/guides/node-exporter/
Wants=network-online.target
After=network-online.target

[Service]
User=${NODE_EXPORTER_USER}
Group=${NODE_EXPORTER_USER}
Type=simple
ExecStart=/usr/local/bin/node_exporter \\
    --collector.systemd \\
    --collector.processes \\
    --web.listen-address=:9100

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    log "Systemd service created"
}

start_node_exporter() {
    log "Starting node_exporter..."

    systemctl enable node_exporter
    systemctl start node_exporter

    # Wait a moment and verify
    sleep 2
    if systemctl is-active --quiet node_exporter; then
        log "node_exporter is running ✓"
        log "Metrics available at http://localhost:9100/metrics"
    else
        error "node_exporter failed to start!"
        systemctl status node_exporter
        return 1
    fi
}

main() {
    log "Starting monitoring agents setup..."

    if check_node_exporter; then
        log "node_exporter already configured"
    else
        create_user
        install_node_exporter
        create_systemd_service
        start_node_exporter
    fi

    log "Monitoring agents setup complete!"
}

main "$@"
